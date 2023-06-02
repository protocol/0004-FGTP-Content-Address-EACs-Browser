import { createApp } from 'vue/dist/vue.esm-bundler'
import { createWebHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { createStore  } from 'vuex'

import Locale_en_GB from '@/src/locales/en_GB.js'
import PreviewerStore from '@/src/stores/previewer.js'

import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'

const store = createStore({
	modules: {
		previewer: PreviewerStore
	}
});

const messages = {
	'en_GB': Locale_en_GB
}

const i18n = createI18n({
	locale: 'en_GB',
	fallbackLocale: 'en_GB',
	messages
})

const Previewer = () => import('@/src/components/previewer/Previewer.vue')

const routes = [
	{
		path: '/',
		name: 'previewer',
		title: 'Previewer',
		component: Previewer,
		children: [
			{
				path: ':lang',
				component: Previewer
			}
		]
	}
];

const router = createRouter({
	history: createWebHistory(),
	routes
})

const routerApp = createApp(router)
routerApp.use(router)
routerApp.use(i18n)
routerApp.use(store)
routerApp.use(PrimeVue, {ripple: true})
routerApp.use(ConfirmationService)
routerApp.use(ToastService)
routerApp.mount('#router_app')
