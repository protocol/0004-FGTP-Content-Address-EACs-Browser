import language from '@/src/mixins/i18n/language.js'

const created = function() {
	const that = this
	
	// set language
	this.setLanguage(this.$route)
}

const computed = {
	pdfPanelClass() {
		return this.theme + '-pdf-panel-' + this.themeVariety
	},
	locale() {
		return this.$store.getters['previewer/getLocale']
	},
	theme() {
		return this.$store.getters['previewer/getTheme']
	},
	themeVariety() {
		return this.$store.getters['previewer/getThemeVariety']
	},
	getFilePath() {
		if(this.fileName !== ''){
			return this.path +'?file=' + this.fileName
		}
		return this.path 
	}
}

const watch = {
}

const mounted = async function() {
}

const methods = {
}

const beforeDestroy = function() {
}

const destroyed = function() {
}

export default {
	mixins: [
		language
	],
	components: {
	},
	directives: {
	},
	props: [
		'fileName',
		'path'
	],
	name: 'PdfViewer',
	data () {
		return {
		}
	},
	created: created,
	computed: computed,
	watch: watch,
	mounted: mounted,
	methods: methods,
	beforeDestroy: beforeDestroy,
	destroyed: destroyed
}  