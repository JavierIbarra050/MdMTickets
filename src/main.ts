import { LocalGameStore } from './store'
import { mountApp } from './ui/app'
import './ui/styles.css'

void mountApp(document.querySelector<HTMLElement>('#app')!, new LocalGameStore())
