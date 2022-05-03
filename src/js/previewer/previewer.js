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
		if(state == true) {
			// Retrieve keys from IPFS
			this.sidebarLoading = true
			this.keys = await this.getDagFromIPNS(this.keysDagAddr)

			this.certificateDags = await this.groupCertificatesByAttestationDocuments()
			this.sidebarLoading = false

			// Load PDF thumbnails for side bar
			this.loadPdfThumbs()
		}
	}
}

const mounted = async function() {
	// Init ipfs client
	//	this.ipfs = await create('https://filecoin-green-eac-browser.dzunic.net:5002')
	this.ipfs = await create('/dns4/filecoin-green-eac-browser.dzunic.net/tcp/5002/https')

	// Retrieve keys from IPFS
	this.sidebarLoading = true
	this.keys = await this.getDagFromIPNS(this.keysDagAddr)

	this.certificateDags = await this.groupCertificatesByAttestationDocuments()
	this.sidebarLoading = false

	// Select first attestation document from the list
	this.showAttestationDocument(this.certificateDags[0])

	// Load PDF thumbnails for side bar
	this.loadPdfThumbs()
}

const methods = {
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
	// Filter and group certificates by attestation documents
	async groupCertificatesByAttestationDocuments() {
		const certificateNames = this.keys.dag.certificates

		// Make sure name list is distinct
		const distinctCertificateNames = certificateNames
			.filter((el, ind, ar) => {return ar.map((arel) => {return arel.id}).indexOf(el.id) === ind})

		// Retrieve certificate DAGs from IPFS
		let certificateDags = []
		for (const name of distinctCertificateNames) {
			certificateDags.push({
				ns: name.id,
				dag: await this.getDagFromIPNS(name.id)
			})
		}

		return certificateDags
	},
	// Load PDF thumbs
	async loadPdfThumbs() {
		const that = this
		// TODO, make this lazzy load with sidebar scrolling
		for await (const certificateDag of this.certificateDags) {
			const pdfDag = certificateDag.dag.dag.attestation_document
			this.attestationDocumentLoading[pdfDag.toString()] = true

			// Check if we already have PDFs loaded
			let pdfContent = []
			if(this.attestationDocuments[pdfDag.toString()] == null) {
				for await (const buf of this.ipfs.get(pdfDag)) {
					pdfContent.push(buf)
				}
				this.attestationDocuments[pdfDag.toString()] = pdfContent
			}
			else {
				pdfContent = this.attestationDocuments[pdfDag.toString()]
			}

			// Load doc and create thumbs
			const pdfIpfs = '/ipfs/' + pdfDag.toString()
			const loadingTask = pdfjsLib.getDocument(uint8ArrayConcat(pdfContent))
			loadingTask.promise.then((doc) => {
				// Request a first page
				return doc.getPage(1).then((page) => {
					// Display page on the existing canvas with 100% scale.
					const viewport = page.getViewport({ scale: 0.35 })
					const canvas = document.getElementById('pdf_canvas_' + pdfDag.toString())
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
						that.attestationDocumentLoading[pdfDag.toString()] = false
						return renderTask.promise
					}
					catch (error) {
						that.attestationDocumentLoading[pdfDag.toString()] = false
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
	async showAttestationDocument(certificateDag, manualSelection) {
		// Close sidebar if selection is done manually
		if(manualSelection && !this.preventClosingSidebar)
			this.isSidebarVisible = false

		// Reset preventing sidebar closing flag
		this.preventClosingSidebar = false

		this.pdfFileName = null	// reset viewer
		this.activeAttestationDocument = null
		this.activeCertificateDag = null

		const hash = certificateDag.dag.dag.attestation_document.toString()
		this.pdfFileName = this.ipfsGateway + '/ipfs/' + hash
		this.activeAttestationDocument = hash
		this.activeCertificateDag = certificateDag

		// List certificates
		const certificatesList = this.activeCertificateDag.dag.dag.certificates
			.map(async (cert) => {return {
				'minerId': cert.miner,
				'certificate': await this.getDag(cert.certificate)
			}})
		this.certificatesList = await all(certificatesList)

		// Calculate total RECs
		this.totalRECs = this.certificatesList
			.map((cert) => {return cert.certificate.dag.energyWh})
			.reduce((a, b) => a + b, 0) / 1000000

		// Calculate subset REC sums (per miner Id)
		const miners = this.certificatesList
			.filter((el, ind, ar) => {return ar.map((arel) => {return arel.minerId}).indexOf(el.minerId) === ind})
			.map((el) => {return el.minerId})
		this.minerRecs = []
		for (const miner of miners) {
			const recs = this.certificatesList
				.filter((cert) => {return cert.minerId == miner})
				.map((cert) => {return cert.certificate.dag.energyWh})
				.reduce((a, b) => a + b, 0) / 1000000
			this.minerRecs.push({
				minerId: miner,
				RECs: recs
			})
		}
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
		OverlayPanel
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
			keysDagAddr: 'k51qzi5uqu5dkqlp786o57kxpfs97nvxu41ha15kdnocgy1zilrx4rvonscbo6',
//			keysDagAddr: '/ipns/dzunic.net',
			keys: [],
			isSidebarVisible: true,
			preventClosingSidebar: false,
			sidebarLoading: true,
			certificateDags: [],
			attestationDocuments: {},
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
			ocMinerPowerRawBytePower: ''
			}
	},
	created: created,
	computed: computed,
	watch: watch,
	mounted: mounted,
	methods: methods,
	destroyed: destroyed
}
