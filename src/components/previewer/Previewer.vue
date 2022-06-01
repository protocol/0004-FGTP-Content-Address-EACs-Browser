<template>
	<section :class="previewerClass">
		<Sidebar v-model:visible="isSidebarVisible">
			<SkeletonCard
				v-if="sidebarLoading && attestationDocuments.length == 0" />
			<div v-for="attestationDocument in attestationDocuments"
				:class="['certificate-thumbs', {'active': (activeAttestationDocument == attestationDocument.hash)}]"
				@click="showAttestationDocument(attestationDocument, true)"
				:key="attestationDocument.hash">
				<canvas :id="'pdf_canvas_' + attestationDocument.hash"
					v-if="!sidebarLoading"></canvas>
				<SkeletonCard
					v-if="sidebarLoading || attestationDocumentLoading[attestationDocument.hash]" />
				<div class="certificate-cid"
					@click ="showPopupDialog($event)">
					{{ '/ipfs/' + attestationDocument.hash }}
					<input :ref="'ipfs_' + attestationDocument.hash" type="hidden" :value="'/ipfs/' + attestationDocument.hash">
				</div>
			</div>
		</Sidebar>
		<ScrollPanel style="width: calc(100% - 3.5rem); height: 50px; margin-left: 3.5rem">
			<TabMenu :model="deliveriesTabs" :activeIndex="activeDeliveriesTab"
				@tab-change="deliveriesTabsChanged" />
		</ScrollPanel>
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
							<div class="shade">Attestation document CID:</div> <div 
								@click="openWithGateway('/ipfs/' + activeAttestationDocument)" class="no-wrap-ellipsis clickable text-link flex-grow left-space">{{ '/ipfs/' + activeAttestationDocument }}</div>
						</div>
					</Panel>
				</div>
				<div class="section"
					v-if="activeAttestationDocument != null">
					<DataTable :value="tableList" rowGroupMode="subheader" groupRowsBy="certificate"
        				sortMode="single" sortField="certificate" :sortOrder="1"
						responsiveLayout="scroll" :expandableRowGroups="true" v-model:expandedRowGroups="expandedRowGroups">

						<Column field="certificate" header="Certificate">
							<template #body="slotProps">
								<div class="clickable text-link">
									{{ slotProps.data.certificate }}
								</div>
							</template>
						</Column>
						<Column field="minerId" header="Miner">
							<template #body="slotProps">
								<div class="clickable text-link green"
									@click="getOnChainData(slotProps.data.minerId, $event)">
									{{ slotProps.data.minerId }}
								</div>
							</template>
						</Column>
						<Column field="reportingStart" header="Reporting start">
							<template #body="slotProps">
								<div class="">
									{{ moment(slotProps.data.reportingStart).format("YYYY-MM-DD") }}
								</div>
							</template>
						</Column>
						<Column field="reportingEnd" header="Reporting end">
							<template #body="slotProps">
								<div class="">
									{{ moment(slotProps.data.reportingEnd).format("YYYY-MM-DD") }}
								</div>
							</template>
						</Column>
						<Column field="minerAllocationVolumeMWh" header="RECs">
							<template #body="slotProps">
								<div class="">
									{{ slotProps.data.minerAllocationVolumeMWh }}
								</div>
							</template>
						</Column>
						<template #groupheader="slotProps">
							<div class="groupheader-content-holder">
								<div class="details-holder">
									<div class="details-title">
										Certificate
									</div>
									<div class="details-value">
										<span class="strong">{{ slotProps.data.certificate }},</span>
										<span>{{ slotProps.data.country }}</span><span v-if="slotProps.data.region">, {{ slotProps.data.region }}</span>
									</div>
								</div>
								<div class="details-holder">
									<div class="details-title">
										Generation
									</div>
									<div class="details-value">
										<span class="strong">{{ moment(slotProps.data.generationStart).format("YYYY-MM-DD") }}</span> /
										<span class="strong">{{ moment(slotProps.data.generationEnd).format("YYYY-MM-DD") }}</span>
										<span v-if="slotProps.data.generatorName" class="strong">, {{ slotProps.data.generatorName }}</span>
									</div>
								</div>
								<div class="details-holder">
									<div class="details-title">
										Source / RECs
									</div>
									<div class="details-value">
										<span class="strong">{{ slotProps.data.energySource }}</span> /
										<span class="strong">{{ slotProps.data.certificateVolumeWh / 1000000 }} MWh</span>
									</div>
								</div>
								<div class="details-holder">
									<div class="details-title">
										Product type / Label
									</div>
									<div class="details-value">
										<span class="strong">{{ slotProps.data.productType }}</span>
										<span v-if="slotProps.data.label" class="strong">/ {{ slotProps.data.label }}</span>
									</div>
								</div>
							</div>
						</template>
						<template #groupfooter="slotProps">
							<div class="allocated-recs">
								<div class="allocated-recs-title">RECs allocated by this certificate:</div>
								<div class="allocated-recs-value">{{ allocatedRecs[slotProps.data.certificate] }} MWh</div>
							</div>
						</template>
					</DataTable>
					<div class="total-recs">
						<div class="total-recs-title">Totally allocated RECs:</div>
						<div class="total-recs-value">{{ totalRECs }} MWh</div>
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
