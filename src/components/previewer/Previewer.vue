<template>
	<section :class="previewerClass">
		<Sidebar v-model:visible="isSidebarVisible">
			<SkeletonCard
				v-if="sidebarLoading && certificateDags.length == 0" />
			<div v-for="certificateDag in certificateDags"
				:class="['certificate-thumbs', {'active': (activeAttestationDocument == certificateDag.dag.dag.attestation_document.toString())}]"
				@click="showAttestationDocument(certificateDag, true)"
				:key="certificateDag.dag.dag.attestation_document.toString()">
				<canvas :id="'pdf_canvas_' + certificateDag.dag.dag.attestation_document.toString()"
					v-if="attestationDocuments[certificateDag.dag.dag.attestation_document.toString()] != null && !sidebarLoading"></canvas>
				<SkeletonCard
					v-if="attestationDocuments[certificateDag.dag.dag.attestation_document.toString()] == null || sidebarLoading || attestationDocumentLoading[certificateDag.dag.dag.attestation_document.toString()]" />
				<div class="certificate-cid"
					@click.stop="showPopupDialog($event)">
					{{ '/ipfs/' + certificateDag.dag.dag.attestation_document.toString() }}
					<input :ref="'ipfs_' + certificateDag.dag.dag.attestation_document.toString()" type="hidden" :value="'/ipfs/' + certificateDag.dag.dag.attestation_document.toString()">
				</div>
			</div>
		</Sidebar>
		<div class="panels">
			<div class="pdf-panel">
				<SkeletonList
					v-if="activeAttestationDocument === null" />
				<PdfViewer v-if="pdfFileName !== null"
					:path='`${pdfViewerPath}`' :fileName='`${pdfFileName}`' />
			</div>
			<div class="metadata-panel">
				<SkeletonList
					v-if="activeAttestationDocument === null" />
				<div class="section"
					v-if="activeAttestationDocument != null">
					<Panel header="Links" :toggleable="true" :collapsed="false">
						<div class="flex-inline no-wrap">
							<div class="shade">Certificates DAG:</div> <div 
								@click="showInExplorer(activeCertificateDag.dag.cid.toString())" class="no-wrap-ellipsis clickable text-link flex-grow left-space">{{ activeCertificateDag.dag.cid.toString() }}</div>
						</div>
						<div class="flex-inline no-wrap">
							<div class="shade">Attestation document CID:</div> <div 
								@click="openWithGateway('/ipfs/' + activeAttestationDocument)" class="no-wrap-ellipsis clickable text-link flex-grow left-space">{{ '/ipfs/' + activeAttestationDocument }}</div>
						</div>
					</Panel>
				</div>
				<div class="section"
					v-if="activeAttestationDocument != null">
					<DataTable :value="certificatesList" v-model:expandedRows="expandedCertificateRows" dataKey="certificate.cid">
						<Column :expander="true" headerStyle="width: 3rem" />
						<Column field="minerId" header="Miner" :sortable="true">
							<template #body="slotProps">
								<div class="clickable text-link green"
									@click="getOnChainData(slotProps.data.minerId, $event)">
									{{ slotProps.data.minerId }}
								</div>
							</template>
						</Column>
						<Column field="certificate.dag.generatorName" header="Generator" :sortable="true">
							<template #body="slotProps">
								<div class="clickable text-link"
									@click="showInExplorer(slotProps.data.certificate.cid)">
									{{ slotProps.data.certificate.dag.generatorName }}
								</div>
							</template>
						</Column>
						<Column field="certificate.dag.energySource" header="Source" :sortable="true"></Column>
						<Column field="certificate.dag.energyWh" header="RECs" :sortable="true">
							<template #body="slotProps">
								<div class="clickable text-link"
									@click="showInExplorer(slotProps.data.certificate.cid)">
									{{ slotProps.data.certificate.dag.energyWh/1000000 }}
								</div>
							</template>
						</Column>
						<template #expansion="slotProps">
							<div class="details-holder space-left">
								<div class="details-title">
									Label:
								</div>
								<div class="details-value">
									{{ slotProps.data.certificate.dag.label }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Country:
								</div>
								<div class="details-value">
									{{ slotProps.data.certificate.dag.country }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Region:
								</div>
								<div class="details-value">
									{{ slotProps.data.certificate.dag.region }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Generator:
								</div>
								<div class="details-value">
									{{ slotProps.data.certificate.dag.generatorName }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Capacity:
								</div>
								<div class="details-value">
									{{ slotProps.data.certificate.dag.nameplateCapacityW/1000000 }} MW
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Energy source:
								</div>
								<div class="details-value">
									{{ slotProps.data.certificate.dag.energySource }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Energy / RECs:
								</div>
								<div class="details-value">
									{{ slotProps.data.certificate.dag.energyWh/1000000 }} MW
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Product:
								</div>
								<div class="details-value">
									{{ slotProps.data.certificate.dag.productType }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Generation start:
								</div>
								<div class="details-value">
									{{ moment(slotProps.data.certificate.dag.generationStart).format('MMM Do YYYY') }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Generation end:
								</div>
								<div class="details-value">
									{{ moment(slotProps.data.certificate.dag.generationEnd).format('MMM Do YYYY') }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Reporting start:
								</div>
								<div class="details-value">
									{{ moment(slotProps.data.certificate.dag.reportingStart).format('MMM Do YYYY') }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Reporting end:
								</div>
								<div class="details-value">
									{{ moment(slotProps.data.certificate.dag.reportingEnd).format('MMM Do YYYY') }}
								</div>
							</div>
							<div class="details-holder space-left">
								<div class="details-title">
									Redemption date:
								</div>
								<div class="details-value">
									{{ moment(slotProps.data.certificate.dag.redemptionDate).format('MMM Do YYYY') }}
								</div>
							</div>
						</template>
					</DataTable>
					<div class="total-recs">
						<div class="total-recs-title">Total RECs:</div>
						<div class="total-recs-value">{{ totalRECs }}</div>
					</div>
					<div class="total-recs small"
						v-for="rec in minerRecs" :key="rec.minerId">
						<div class="total-recs-title">{{ rec.minerId }}:</div>
						<div class="total-recs-value">{{ rec.RECs }}</div>
					</div>
				</div>
			</div>
		</div>
		<OverlayPanel ref="op" :breakpoints="{'960px': '75vw', '640px': '100vw'}" :style="{width: '450px'}"
			showCloseIcon="true">
			<div class="details-holder">
				<div class="details-title">
					Owner:
				</div>
				<div class="details-value">
					{{ ocMinerInfoOwner }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Worker:
				</div>
				<div class="details-value">
					{{ ocMinerInfoWorker }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					New worker:
				</div>
				<div class="details-value">
					{{ ocMinerInfoNewWorker }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Control addresses:
				</div>
				<div class="details-value">
					{{ ocMinerInfoControlAddresses }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Peer Id:
				</div>
				<div class="details-value no-wrap-ellipsis">
					{{ ocMinerInfoPeerId }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Multiaddrs:
				</div>
				<div class="details-value">
					{{ ocMinerInfoMultiaddrs }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Sector size:
				</div>
				<div class="details-value">
					{{ ocMinerInfoSectorSize }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Win. PoSt Par. Sec.:
				</div>
				<div class="details-value">
					{{ ocMinerInfoWindowPoStPartitionSectors }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Win. PoSt Proof Type:
				</div>
				<div class="details-value">
					{{ ocMinerInfoWindowPoStProofType }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Quality Adj. Power:
				</div>
				<div class="details-value">
					{{ ocMinerPowerQualityAdjPower }}
				</div>
			</div>
			<div class="details-holder">
				<div class="details-title">
					Raw Byte Power:
				</div>
				<div class="details-value">
					{{ ocMinerPowerRawBytePower }}
				</div>
			</div>
		</OverlayPanel>
		<ConfirmPopup />
		<Toast position="top-right" />
		<div class="menu-button"
			v-if="!isSidebarVisible"
			@click="isSidebarVisible = !isSidebarVisible">
			<i class="pi pi-align-justify"></i>
		</div>
	</section>
</template>

<script src="@/src/js/previewer/previewer.js" scoped />
<style src="@/src/scss/previewer/previewer.scss" lang="scss" scoped />
