import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // L'identifiant ne se change plus une fois l'app publiée : c'est sous lui que
  // le Play Store et l'App Store rangent les installations et les avis.
  appId: 'fr.lettreminute.app',
  appName: 'Lettre Minute',
  webDir: 'dist',
  plugins: {
    // Masqué par l'app elle-même, une fois le premier écran peint : un délai
    // fixe montrerait soit un écran blanc, soit un logo qui s'attarde.
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#f6f1e7',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    // La partie est ancrée en haut de l'écran : le clavier peut rétrécir la vue
    // sans rien faire sauter.
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
}

export default config
