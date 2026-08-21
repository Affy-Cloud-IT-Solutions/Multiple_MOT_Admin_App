import { Alert, AlertButton, AlertOptions } from 'react-native';

export type AlertParams = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

let showHandler: ((params: AlertParams) => void) | null = null;
let hideHandler: (() => void) | null = null;

export const setAlertHandlers = (
  show: (params: AlertParams) => void,
  hide: () => void
) => {
  showHandler = show;
  hideHandler = hide;
};

// Override React Native's native Alert.alert
const originalAlert = Alert.alert;

Alert.alert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => {
  if (showHandler) {
    showHandler({ title, message, buttons, options });
  } else {
    // Fallback to original native alert if modal is not yet mounted
    originalAlert(title, message, buttons, options);
  }
};

export const dismissCustomAlert = () => {
  if (hideHandler) {
    hideHandler();
  }
};
