<template>
	<section :class="skeletonListClass">
        <div class="custom-skeleton p-4">
            <ul class="m-0 p-0">
                <li class="mb-3">
                    <div class="flex">
                        <Skeleton shape="circle" size="4rem" class="mr-2"></Skeleton>
                        <div style="flex: 1">
                            <Skeleton width="100%" class="mb-2"></Skeleton>
                            <Skeleton width="75%"></Skeleton>
                        </div>
                    </div>
                </li>
                <li class="mb-3">
                    <div class="flex">
                        <Skeleton shape="circle" size="4rem" class="mr-2"></Skeleton>
                        <div style="flex: 1">
                            <Skeleton width="100%" class="mb-2"></Skeleton>
                            <Skeleton width="75%"></Skeleton>
                        </div>
                    </div>
                </li>
                <li class="mb-3">
                    <div class="flex">
                        <Skeleton shape="circle" size="4rem" class="mr-2"></Skeleton>
                        <div style="flex: 1">
                            <Skeleton width="100%" class="mb-2"></Skeleton>
                            <Skeleton width="75%"></Skeleton>
                        </div>
                    </div>
                </li>
                <li>
                    <div class="flex">
                        <Skeleton shape="circle" size="4rem" class="mr-2"></Skeleton>
                        <div style="flex: 1">
                            <Skeleton width="100%" class="mb-2"></Skeleton>
                            <Skeleton width="75%"></Skeleton>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    </section>
</template>

<script src="@/src/js/common/skeleton-list.js" scoped />
<style src="@/src/scss/common/skeleton-list.scss" lang="scss" scoped />
