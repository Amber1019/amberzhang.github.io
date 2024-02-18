import { createApp } from 'vue'
import App from './App.vue'
import 'solana-wallets-vue/styles.css'
import VueCryptojs from 'vue-cryptojs'

createApp(App).use(VueCryptojs).mount('#app')
