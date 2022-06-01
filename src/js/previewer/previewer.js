import language from '@/src/mixins/i18n/language.js'
import PdfViewer from '@/src/components/pdf-panel/PdfViewer.vue'
import SkeletonCard from '@/src/components/common/SkeletonCard.vue'
import SkeletonList from '@/src/components/common/SkeletonList.vue'

import { create } from 'ipfs-http-client'
import { CID } from 'multiformats/cid'

import { mainnet } from '@filecoin-shipyard/lotus-client-schema'
import { BrowserProvider } from '@filecoin-shipyard/lotus-client-provider-browser'
import { LotusRPC } from '@filecoin-shipyard/lotus-client-rpc'

import all from 'it-all'
import moment from 'moment'

import * as pdfjsLib from 'pdfjs-dist/webpack'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'

import Sidebar from 'primevue/sidebar'
import ConfirmPopup from 'primevue/confirmpopup'
import Toast from 'primevue/toast'
import Panel from 'primevue/panel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import OverlayPanel from 'primevue/overlaypanel'
import TabMenu from 'primevue/tabmenu'
import ScrollPanel from 'primevue/scrollpanel'

const created = function() {
	const that = this
	
	// set language
	this.setLanguage(this.$route)
}

const computed = {
	previewerClass() {
		return this.theme + '-previewer-' + this.themeVariety
	},
	locale() {
		return this.$store.getters['previewer/getLocale']
	},
	theme() {
		return this.$store.getters['previewer/getTheme']
	},
	themeVariety() {
		return this.$store.getters['previewer/getThemeVariety']
	}
}

const watch = {
	isSidebarVisible: async function(state, before) {
		if(!state)
			return
		// Load PDF thumbnails for side bar
		await this.loadPdfThumbs()

		// Add scrolling event to sidebar
		this.addEventToClassName("p-sidebar-content", "scroll")
	},
	activeDeliveriesTab: async function(state, before) {
		if(state == null)
			return
		this.attestationDocuments.length = 0
		this.extractedCertificates.length = 0
		this.loadingCerticicatesStart = 0
		this.loadingCerticicatesEnd = 0
		this.loadingHigher = true
		this.sidebarLoading = true
		this.isSidebarVisible = true
		this.certificates = (await this.getDag(this.deliveries[this.deliveriesTabs[state].label].deliveries_cid)).dag.certificates
		this.allocations = (await this.getDag(this.transactions[this.deliveriesTabs[state].label].allocations_cid)).dag
	},
	certificates: async function(state, before) {
		await this.matchAttestationNameToCertificates()
		await this.createLoadingBatch()
	}
}

const mounted = async function() {
	// Init ipfs client
	//	this.ipfs = await create('https://filecoin-green-eac-browser.dzunic.net:5002')
	this.ipfs = await create('/dns4/filecoin-green-eac-browser.dzunic.net/tcp/5002/https')

	// Add scrolling event to sidebar
	this.addEventToClassName("p-sidebar-content", "scroll")

	// Retrieve transactions and deliveries from IPFS
	const td = await this.getTransactionsAndDeliveries()
	this.transactions = td.transactions
	this.deliveries = td.deliveries
	this.deliveriesTabs = this.getDeliveriesTabs()
	if(this.activeDeliveriesTab == null)
		this.activeDeliveriesTab = 0
}

const methods = {
	// Handle element scrolling events
	elementScrolling(event) {
		if(this.sidebarLoading)
			return
		const element = event.target
		const reachedBottom = Math.ceil(element.scrollHeight - element.scrollTop) === element.clientHeight
		const reachedTop = element.scrollTop === 0
		if(reachedBottom) {
			this.loadingHigher = true
			this.createLoadingBatch()
		}
		else if(reachedTop) {
			this.loadingHigher = false
			this.createLoadingBatch()
		}
	},
	// Add event to DOM elements with same className
	addEventToClassName(className, event) {
		var elements = document.getElementsByClassName(className);
		
		for (var i = 0; i < elements.length; i++) {
			elements[i].addEventListener(event, this.elementScrolling, false);
		}
	},
	// Resolve IPNS name
	async resolveIpnsId(id) {
		let hash
		for await (const name of this.ipfs.name.resolve(id)) {
			hash = name
		}
		return hash
	},
	// Retrieve DAG object from IPNS
	async getDagFromIPNS(id) {
		let dag
		const hash = (await this.resolveIpnsId(id)).replace('/ipfs/', '')

		// Create CID
		const cid = CID.parse(hash)

		return await this.getDag(cid)
	},
	// Retrieve DAG object from content address
	async getDag(cid) {
		let dag
		// Grab DAG
		dag = await this.ipfs.dag.get(cid, {})

		return {
			cid: cid,
			dag: dag.value
		}
	},
	// Get transactions and deliveries objects from IPNS/IPFS
	async getTransactionsAndDeliveries() {
		return {
			"transactions": (await this.getDag((await this.getDagFromIPNS(this.transactionsKey)).dag.transactions_cid)).dag,
			"deliveries": (await this.getDag((await this.getDagFromIPNS(this.deliveriesKey)).dag.deliveries_cid)).dag
		}
	},
	getDeliveriesTabs() {
		return Object.keys(this.deliveries).map((d) => {return {
			"label": d,
			"icon": null
		}})
	},
	deliveriesTabsChanged(tabs) {
		this.activeDeliveriesTab = tabs.index
	},
	async matchAttestationNameToCertificates() {
		this.certificatesWithAttestationName = this.certificates.map(async (c) => {
			let attestationDocumentName = c.id.substring(0, c.id.indexOf("_certificate_"))
			return {
				"id": c.id,
				"cid": c.cid,
				"certificate": await this.getDag(c.cid),
				"attestation": attestationDocumentName
			}
		})
		this.certificatesWithAttestationName = await all(this.certificatesWithAttestationName)
	},
	async createLoadingBatch() {
		let crt = {}
		let hashes = {}
		const totalCerts = this.certificates.length

		// Calculate batch index basing on direction
		if(this.loadingHigher) {	// higher indexes
			if(this.loadingCerticicatesEnd >= totalCerts - 1)
				return

			this.sidebarLoading = true
			this.attestationDocuments.length = 0
			this.loadingCerticicatesStart = (this.loadingCerticicatesEnd == 0) ? 0 : this.loadingCerticicatesEnd + 1
			let index = this.loadingCerticicatesStart

			while (this.attestationDocuments.length < this.loadingBatch && index < totalCerts) {
				const certificate = this.certificates[index]
				let cert = await this.getDag(certificate.cid)
				crt = cert.dag
				crt.id = certificate.id

				const cid = crt.attestationDocumentCid
				const hash = cid.toString()
	
				// Check if we already have document loaded
				let content = []
				if(hashes[hash] == null) {
					hashes[hash] = hash
					for await (const buf of this.ipfs.get(cid)) {
						content.push(buf)
					}
					this.attestationDocuments.push({
						"hash": hash,
						"content": content,
						"attestation": crt.attestation_file
					})
				}
				index++
			}
			this.loadingCerticicatesEnd = index - 1
		}
		else {				// lower indexes
			if(this.loadingCerticicatesStart <= 0)
				return

			this.sidebarLoading = true
			this.attestationDocuments.length = 0
			this.loadingCerticicatesEnd = (this.loadingCerticicatesStart == 0) ? 0 : this.loadingCerticicatesStart - 1
			let index = this.loadingCerticicatesEnd

			while (this.attestationDocuments.length < this.loadingBatch && index >= 0) {
				const certificate = this.certificates[index]
				let cert = await this.getDag(certificate.cid)
				crt = cert.dag
				crt.id = certificate.id

				const cid = crt.attestationDocumentCid
				const hash = cid.toString()

				// Check if we already have document loaded
				let content = []
				if(hashes[hash] == null) {
					hashes[hash] = hash
					for await (const buf of this.ipfs.get(cid)) {
						content.push(buf)
					}
					this.attestationDocuments.push({
						"hash": hash,
						"content": content,
						"attestation": crt.attestation_file
					})
				}
				index--
			}
			this.attestationDocuments.reverse()
			this.loadingCerticicatesStart = index + 1
		}
		this.sidebarLoading = false

		// Load PDF thumbnails for side bar
		await this.loadPdfThumbs()

		// Select first attestation document from the batch
		this.showAttestationDocument(this.attestationDocuments[0])
	},
	// Load PDF thumbs
	async loadPdfThumbs() {
		const that = this
		// TODO, make this lazzy load with sidebar scrolling
		for (const attestationDocument of this.attestationDocuments) {
			const hash = attestationDocument.hash
			const content = attestationDocument.content
			this.attestationDocumentLoading[hash] = true
			// Load doc and create thumbs
			const pdfIpfs = '/ipfs/' + hash
			const loadingTask = pdfjsLib.getDocument(uint8ArrayConcat(attestationDocument.content))
			loadingTask.promise.then((doc) => {
				// Request a first page
				return doc.getPage(1).then((page) => {
					// Display page on the existing canvas with 100% scale.
					const viewport = page.getViewport({ scale: 0.35 })
					const canvas = document.getElementById('pdf_canvas_' + hash)
					try {
						//		canvas.width = viewport.width
						//		canvas.height = viewport.height
						canvas.width = 200
						canvas.height = 250
						const ctx = canvas.getContext("2d")
						const renderTask = page.render({
							canvasContext: ctx,
							viewport
						})
						that.attestationDocumentLoading[hash] = false
						return renderTask.promise
					}
					catch (error) {
						that.attestationDocumentLoading[hash] = false
						return null
					}
				})
			}, (err) => {
				console.error(`Error during ${pdfIpfs} loading: ${err}`)
			})
		}
	},
	// Show IPFS CID dialog
	showPopupDialog(event) {
		const that = this
		this.$confirm.require({
			target: event.currentTarget,
			message: event.target.innerText,
			icon: null,
			accept: () => {
				window.open(this.ipfsGateway + event.target.innerText)
			},
			acceptIcon: 'pi pi-link',
			acceptLabel: 'Open',
			reject: () => {
				if (!navigator.clipboard){
					that.$refs['ipfs_' + event.target.innerText.replace('/ipfs/', '')][0].focus()
					that.$refs['ipfs_' + event.target.innerText.replace('/ipfs/', '')][0].select()
					document.execCommand('copy')
					that.$toast.add({
						severity: 'success',
						summary: 'Success!',
						detail: event.target.innerText + " is copied to clipboard!",
						life: 3000
					})
				}
				else {
					navigator.clipboard.writeText(event.target.innerText).then(
						() => {
							that.$toast.add({
								severity: 'success',
								summary: 'Success!',
								detail: event.target.innerText + " is copied to clipboard!",
								life: 3000
							})
						})
						.catch(
						() => {
							that.$toast.add({
								severity: 'error',
								summary: 'Error!',
								detail: event.target.innerText + " is NOT copied to clipboard!",
								life: 3000
							})
					})
				}
			},
			rejectIcon: 'pi pi-copy',
			rejectLabel: 'Copy'
		})

		// Since @click.stop prevents $confirm popup
		// positioning correctly this is a workaround
		this.preventClosingSidebar = true
	},
	// Show selected attestation document (and metadata)
	async showAttestationDocument(attestationDocument, manualSelection) {
		const that = this
		// Close sidebar if selection is done manually
		if(manualSelection && !this.preventClosingSidebar)
			this.isSidebarVisible = false

		// Reset preventing sidebar closing flag
		this.preventClosingSidebar = false

		this.pdfFileName = null	// reset viewer
		this.activeAttestationDocument = null

		const attestationName = attestationDocument.attestation.replace(".pdf", "")

		const attestationCertificates = this.certificatesWithAttestationName.filter((c) => {
			return c.attestation == attestationName
		})
		this.attestationCertificates = {}
		for (const ac of attestationCertificates) {
			let supplies = []
			if(this.attestationCertificates[ac.attestation] == null)
				this.attestationCertificates[ac.attestation] = []

			if(ac.certificate.dag.supplies != null)
				for (const supply of ac.certificate.dag.supplies) {
					supplies.push((await this.getDag(supply)).dag)
				}

			this.attestationCertificates[ac.attestation].push({
				"id": ac.id,
				"certificate": ac.certificate.dag,
				"supplies": supplies
			})
		}

		this.certificatesList = this.attestationCertificates[attestationName]

		const hash = attestationDocument.hash
		this.pdfFileName = this.ipfsGateway + '/ipfs/' + hash
		this.activeAttestationDocument = hash

		// List certificates
		this.tableList.length = 0
		this.allocatedRecs = {}
		for (const c of this.certificatesList) {
			this.allocatedRecs[c.certificate.certificate] = 0
			for (const s of c.supplies) {
				this.tableList.push({
					"certificate": c.certificate.certificate,
					"country": c.certificate.country,
					"region": c.certificate.region,
					"generatorName": c.certificate.generatorName,
					"energySource": c.certificate.energySource,
					"label": c.certificate.label,
					"productType": c.certificate.productType,
					"generationStart": c.certificate.generationStart,
					"generationEnd": c.certificate.generationEnd,
					"reportingStart": c.certificate.reportingStart,
					"reportingEnd": c.certificate.reportingEnd,
					"sellerName": c.certificate.sellerName,
					"sellerAddress": c.certificate.sellerAddress,
					"certificateVolumeWh": c.certificate.volume_Wh,
					"minerId":  that.allocations[s.allocation].minerID,
					"defaulted":  that.allocations[s.allocation].defaulted,
					"minerAllocationVolumeMWh": s.volume_MWh
				})
				this.allocatedRecs[c.certificate.certificate] += s.volume_MWh
			}
		}

		// Calculate total RECs
		this.totalRECs = this.tableList
			.map((s) => {return s.minerAllocationVolumeMWh})
			.reduce((a, b) => a + b, 0)
	},
	// Show DAG in IPLD explorer
	showInExplorer(hash) {
		window.open(this.dagExplorer + hash)
	},
	// open with IPFS gateway
	openWithGateway(hash) {
		window.open(this.ipfsGateway + hash)
	},
	// Get on chain miner info
	async getOnChainData(minerId, event) {
		const endpointUrl = 'wss://api.chain.love/rpc/v0'
		const provider = new BrowserProvider(endpointUrl)
		const client = new LotusRPC(provider, { schema: mainnet.fullNode })

		this.ocMinerInfo = {}
		this.ocMinerInfoControlAddresses = ''
		this.ocMinerInfoOwner = ''
		this.ocMinerInfoWorker = ''
		this.ocMinerInfoNewWorker = ''
		this.ocMinerInfoPeerId = ''
		this.ocMinerInfoMultiaddrs = ''
		this.ocMinerInfoSectorSize = 0
		this.ocMinerInfoWindowPoStPartitionSectors = 0
		this.ocMinerInfoWindowPoStProofType = 0

		this.ocMinerPower = {}
		this.ocMinerPowerQualityAdjPower = ''
		this.ocMinerPowerRawBytePower = ''

		this.$refs.op.toggle(event)

		const { Height: head } = await client.chainHead()
		console.log('chainHead = ', head)

		this.ocMinerInfo = await client.stateMinerInfo(minerId, [])
		this.ocMinerInfoControlAddresses = (this.ocMinerInfo.ControlAddresses != null) ? this.ocMinerInfo.ControlAddresses.join(', ') : ''
		this.ocMinerInfoOwner = this.ocMinerInfo.Owner
		this.ocMinerInfoWorker = this.ocMinerInfo.Worker
		this.ocMinerInfoNewWorker = this.ocMinerInfo.NewWorker
		this.ocMinerInfoPeerId = this.ocMinerInfo.PeerId
		this.ocMinerInfoMultiaddrs = (this.ocMinerInfo.Multiaddrs != null) ? this.ocMinerInfo.Multiaddrs.join(', ') : ''
		this.ocMinerInfoSectorSize = this.ocMinerInfo.SectorSize
		this.ocMinerInfoWindowPoStPartitionSectors = this.ocMinerInfo.WindowPoStPartitionSectors
		this.ocMinerInfoWindowPoStProofType = this.ocMinerInfo.WindowPoStProofType
		console.log('miner = ', this.ocMinerInfo)

		this.ocMinerPower = await client.stateMinerPower(minerId, [])
		let ocMinerPowerQualityAdjPower = this.ocMinerPower.MinerPower.QualityAdjPower/(Math.pow(1024, 5))
		ocMinerPowerQualityAdjPower = Math.round((ocMinerPowerQualityAdjPower + Number.EPSILON) * 10000)/10000
		this.ocMinerPowerQualityAdjPower = ocMinerPowerQualityAdjPower + ' TB'
		let ocMinerPowerRawBytePower = this.ocMinerPower.MinerPower.RawBytePower/(Math.pow(1024, 5))
		ocMinerPowerRawBytePower = Math.round((ocMinerPowerRawBytePower + Number.EPSILON) * 10000)/10000
		this.ocMinerPowerRawBytePower = ocMinerPowerRawBytePower + ' TB'
		console.log('minerPower = ', this.ocMinerPower)
		const stateLookupID = await client.stateLookupID(minerId, [])
		console.log('stateLookupID = ', stateLookupID)
		const stateMarketBalance = await client.stateMarketBalance(minerId, [])
		console.log('stateMarketBalance = ', stateMarketBalance)
		const stateGetActor = await client.stateGetActor(minerId, [])
		console.log('stateGetActor = ', stateGetActor)
	}
}

const destroyed = function() {
}

export default {
	mixins: [
		language
	],
	components: {
		PdfViewer,
		SkeletonCard,
		SkeletonList,
		Sidebar,
		ConfirmPopup,
		Toast,
		Panel,
		DataTable,
		Column,
		OverlayPanel,
		TabMenu,
		ScrollPanel
	},
	directives: {
	},
	name: 'Previewer',
	data () {
		return {
			moment: moment,
			ipfs: null,
			ipfsGateway: 'https://ipfs.io',
			dagExplorer: 'https://explore.ipld.io/#/explore/',
//			keysDagAddr: 'k51qzi5uqu5dkqlp786o57kxpfs97nvxu41ha15kdnocgy1zilrx4rvonscbo6',
			transactionsKey: 'k51qzi5uqu5dlf3u2vtyxnqgr2hozq5g6ad9hb8gy25yr593cy3vw6zcko0xgk',
			deliveriesKey: 'k51qzi5uqu5dmj5nhnozluv80g7h8hhrer9fc2urn5yllciewhapqbbevn8w5p',
			transactions: {},
			deliveries: {},
			deliveriesTabs: [],
			activeDeliveriesTab: null,
			certificates: [],
			extractedCertificates: [],
			loadingBatch: 10,
			loadingCerticicatesStart: 0,
			loadingCerticicatesEnd: 0,
			loadingHigher: true,
			attestationCertificates: {},
			certificatesWithAttestationName: [],
			tableList: [],
			allocatedRecs: {},
//			keysDagAddr: '/ipns/dzunic.net',
			keys: [],
			isSidebarVisible: true,
			preventClosingSidebar: false,
			sidebarLoading: true,
			attestationDocuments: [],
			pdfViewerPath: 'libs/pdfjs-2.13.216-dist/web/viewer.html',
			pdfFileName: null,
			activeAttestationDocument: null,
			activeCertificateDag: null,
			attestationDocumentLoading: {},
			certificatesList: [],
			totalRECs: 0,
			minerRecs: [],
			expandedCertificateRows: [],
			ocMinerInfo: {},
			ocMinerInfoControlAddresses: '',
			ocMinerInfoOwner: '',
			ocMinerInfoWorker: '',
			ocMinerInfoNewWorker: '',
			ocMinerInfoPeerId: '',
			ocMinerInfoMultiaddrs: '',
			ocMinerInfoSectorSize: 0,
			ocMinerInfoWindowPoStPartitionSectors: 0,
			ocMinerInfoWindowPoStProofType: 0,
			ocMinerPower: {},
			ocMinerPowerQualityAdjPower: '',
			ocMinerPowerRawBytePower: '',
			expandedRowGroups: null
		}
	},
	created: created,
	computed: computed,
	watch: watch,
	mounted: mounted,
	methods: methods,
	destroyed: destroyed
}
