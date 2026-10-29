import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetToLogin, isOnLoginScreen } from '../navigation/NavigationService';
import { isTokenExpired, msUntilAccessTokenRefresh, requestTokenRefresh, RefreshOutcome } from '../utils/authSession';

export interface Customer {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  preferredContact: 'SMS' | 'Email' | 'WhatsApp';
  address?: string;
  createdDate: string;
  garageId?: string;
  garageIds?: string[];
  garageConsent?: boolean;
  garageConsentDate?: string;
}

export interface Vehicle {
  id: string;
  _id?: string;
  customerId: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: string;
  motExpiryDate: string;
  lastServiceDate?: string;
  status: 'Active' | 'Sold' | 'Scrapped' | 'Pending' | 'Rejected';
  rejectionReason?: string;
}

export interface AlertNotification {
  id: string;
  _id?: string;
  type: 'NEW_VEHICLE' | 'SOLD' | 'BOOKED' | 'GARAGE_REGISTRATION' | string;
  customerName: string;
  customerId?: string;
  customerEmail?: string;
  customerMobile?: string;
  registrationNumber: string;
  makeModel: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected' | 'Completed' | 'Cancelled';
  rejectionReason?: string;
  garageId?: string;
  serviceName?: string;
  services?: { name: string; category?: string; price?: number; duration?: number }[];
  hasMot?: boolean;
  isDateOnly?: boolean;
  price?: number;
  duration?: number;
  slotTime?: string;
  slotNumber?: number;
  stationId?: string;
  stationName?: string;
  rescheduled?: boolean;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  date: string;
  activity: string;
  details: string;
}

export interface Garage {
  id: string;
  _id?: string;
  name: string;
  logoUrl?: string;
  images?: string[];
  address: string;
  city?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  vtsNumber?: string;
  motAuthorisedExaminerNumber?: string;
  businessRegistrationNumber?: string;
  legalDeclaration?: boolean;
  email: string;
  phone: string;
  openingTime?: string;
  closingTime?: string;
  description?: string;
  services?: any[];
  workingDays?: string[];
  slots?: string[];
  locationConfigured?: boolean;
  servicesConfigured?: boolean;
  documentsConfigured?: boolean;
  /** Computed by the backend: which setup steps are done (location, services, documents) */
  profileCompletion?: { complete: boolean; steps: { location: boolean; services: boolean; documents: boolean }; missing: string[]; percent?: number };
  /** Approved AND profile complete - only then do customers see this garage */
  isVisibleToCustomers?: boolean;
  verificationStatus?: 'Pending' | 'Verified' | 'Rejected' | 'Expired';
  rejectionReason?: string;
  verificationDocuments?: { id?: string; _id?: string; name: string; fileUrl: string; documentType?: string; status?: 'Pending' | 'Verified' | 'Rejected'; rejectionReason?: string; verifiedAt?: string; uploadDate?: string }[];
  rating?: number;
  distance?: number;
  status: 'Approved' | 'Pending' | 'Suspended' | 'Rejected' | 'Blacklisted';
  staffCount?: number;
  bookingsCount?: number;
  customerCount?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'customer' | 'garage_admin';
  customerId?: string;
  garageId?: string;
}

export interface ServiceCategory {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

interface DataContextType {
  customers: Customer[];
  vehicles: Vehicle[];
  alerts: AlertNotification[];
  audits: AuditLog[];
  garages: Garage[];
  serviceCategories: ServiceCategory[];
  fetchServiceCategories: () => Promise<ServiceCategory[]>;
  createServiceCategory: (catData: Partial<ServiceCategory>) => Promise<ServiceCategory>;
  deleteServiceCategory: (categoryId: string) => Promise<void>;
  token: string | null;
  refreshToken: string | null;
  setToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setTokens: (accessToken: string | null, refreshToken: string | null) => void;
  refreshAccessToken: () => Promise<string | null>;
  /** Refreshes the session; only an 'invalid' outcome means the user must log in again */
  refreshSession: () => Promise<RefreshOutcome>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  logout: () => Promise<void>;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  refreshData: (activeToken?: string | null) => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdDate'>) => Promise<string>;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<void>;
  updateVehicleStatus: (vehicleId: string, status: 'Active' | 'Sold' | 'Scrapped' | 'Pending') => Promise<void>;
  addAlert: (alert: Omit<AlertNotification, 'id' | 'status' | 'date'> & { status?: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected', date?: string }) => Promise<void>;
  approveAlert: (alertId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  rejectAlert: (alertId: string, reason: string) => Promise<void>;
  addAudit: (activity: string, details: string) => Promise<void>;
  createStaffAccount: (name: string, email: string, password: string) => Promise<void>;
  fetchStaffList: () => Promise<any[]>;
  deleteStaffAccount: (staffId: string) => Promise<void>;
  rescheduleBooking: (alertId: string, date: string, slot?: string) => Promise<void>;
  cancelBooking: (alertId: string, reason?: string) => Promise<void>;
  lookupVehicle: (vrn: string) => Promise<any>;
  fetchGarages: () => Promise<Garage[]>;
  updateGarageStatus: (garageId: string, status: string, verificationStatus?: string, rejectionReason?: string) => Promise<void>;
  updateGarageDocumentStatus: (garageId: string, docId: string, status: 'Verified' | 'Rejected' | 'Pending', rejectionReason?: string) => Promise<any>;
  updateGarageProfile: (garageId: string, updates: Partial<Garage>) => Promise<any>;
  currentGarage: Garage | null;
  fetchCurrentGarage: () => Promise<Garage | null>;
  uploadGarageDocument: (garageId: string, documentName: string, fileUrl: string, documentType?: string) => Promise<any>;
  submitCurrentGarageForReview: () => Promise<any>;
  fetchGarageServices: (garageId: string) => Promise<any>;
  fetchServiceCatalogTemplates: () => Promise<{ categories: string[]; templates: any[] }>;
  addGarageService: (garageId: string, serviceData: any) => Promise<any>;
  updateGarageService: (garageId: string, serviceId: string, updates: any) => Promise<any>;
  deleteGarageService: (garageId: string, serviceId: string) => Promise<any>;
  seedGarageDefaultServices: (garageId: string) => Promise<any>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Local development backend (port 5000 reverse-tunneled to connected Android device via adb reverse)
// export const BASE_URL = 'http://localhost:5000/api';
export const BASE_URL = 'https://api.ondoorcarservice.com/api';

const decodeToken = (tokenStr: string | null) => {
  if (!tokenStr) return null;
  try {
    const payload = tokenStr.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const raw = base64.replace(/[^A-Za-z0-9+/]/g, '');
    let output = '';
    let i = 0;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    
    while (i < raw.length) {
      const char1 = i < raw.length ? raw.charAt(i++) : '';
      const char2 = i < raw.length ? raw.charAt(i++) : '';
      const char3 = i < raw.length ? raw.charAt(i++) : '';
      const char4 = i < raw.length ? raw.charAt(i++) : '';

      const enc1 = char1 ? chars.indexOf(char1) : -1;
      const enc2 = char2 ? chars.indexOf(char2) : -1;
      const enc3 = char3 ? chars.indexOf(char3) : -1;
      const enc4 = char4 ? chars.indexOf(char4) : -1;

      if (enc1 === -1 || enc2 === -1) break;

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      output += String.fromCharCode(chr1);

      if (enc3 !== -1) {
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        output += String.fromCharCode(chr2);
      }
      if (enc4 !== -1 && enc3 !== -1) {
        const chr3 = ((enc3 & 3) << 6) | enc4;
        output += String.fromCharCode(chr3);
      }
    }
    return JSON.parse(output);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};
 
export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [currentGarage, setCurrentGarage] = useState<Garage | null>(null);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [token, setTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<UserProfile | null>(null);
  // Always hold the latest tokens. Callbacks read these instead of state captured in their closure, so a
  // stale callback can never send a refresh token that has already been rotated (which the server revokes).
  const tokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);

  const setRefreshToken = useCallback((newRefreshToken: string | null) => {
    refreshTokenRef.current = newRefreshToken;
    setRefreshTokenState(newRefreshToken);
    if (newRefreshToken) {
      AsyncStorage.setItem('user_refresh_token', newRefreshToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_refresh_token').catch(err => console.error(err));
    }
  }, []);

  const setToken = useCallback((newToken: string | null) => {
    tokenRef.current = newToken;
    if (!newToken) refreshTokenRef.current = null;
    setTokenState(newToken);
    if (newToken) {
      AsyncStorage.setItem('user_token', newToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_token').catch(err => console.error(err));
      AsyncStorage.removeItem('user_refresh_token').catch(err => console.error(err));
      AsyncStorage.removeItem('user_profile').catch(err => console.error(err));
      setRefreshTokenState(null);
      setUserState(null);
      setCustomers([]);
      setVehicles([]);
      setAudits([]);
      setAlerts([]);
      setGarages([]);
      setCurrentGarage(null);
    }
  }, []);

  const setTokens = useCallback((newToken: string | null, newRefreshToken: string | null) => {
    tokenRef.current = newToken;
    refreshTokenRef.current = newRefreshToken;
    setTokenState(newToken);
    setRefreshTokenState(newRefreshToken);
    if (newToken) {
      AsyncStorage.setItem('user_token', newToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_token').catch(err => console.error(err));
    }
    if (newRefreshToken) {
      AsyncStorage.setItem('user_refresh_token', newRefreshToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_refresh_token').catch(err => console.error(err));
    }
    if (!newToken && !newRefreshToken) {
      AsyncStorage.removeItem('user_profile').catch(err => console.error(err));
      setUserState(null);
      setCustomers([]);
      setVehicles([]);
      setAudits([]);
      setAlerts([]);
      setGarages([]);
      setCurrentGarage(null);
    }
  }, []);

  const setUser = useCallback((newUser: UserProfile | null) => {
    setUserState(newUser);
    if (newUser) {
      AsyncStorage.setItem('user_profile', JSON.stringify(newUser)).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_profile').catch(err => console.error(err));
    }
  }, []);

  // Mutex/singleton to prevent multiple concurrent refresh calls
  const refreshPromiseRef = useRef<Promise<RefreshOutcome> | null>(null);
  const sessionExpiredAlertShownRef = useRef(false);

  const handleSessionExpired = useCallback(() => {
    if (!tokenRef.current && !refreshTokenRef.current) return;
    // Several requests can fail at once - clear the session and show the alert only once
    if (sessionExpiredAlertShownRef.current) return;
    sessionExpiredAlertShownRef.current = true;
    console.warn('[AUTH] Refresh token expired or revoked. Clearing session and navigating to login.');
    setTokens(null, null);
    setUser(null);
    // Already on Login (e.g. at launch): just clear the session, no popup
    if (isOnLoginScreen()) {
      sessionExpiredAlertShownRef.current = false;
      return;
    }
    resetToLogin();
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again to continue.',
      [{ text: 'OK', onPress: () => { sessionExpiredAlertShownRef.current = false; } }]
    );
  }, [setTokens, setUser]);

  /**
   * Exchanges the refresh token for a new access token (and rotated refresh token).
   * Only one refresh runs at a time; concurrent callers share its result. Tokens are stored on success.
   * The session is NOT cleared here - only an 'invalid' outcome should log the user out.
   */
  const refreshSession = useCallback(async (): Promise<RefreshOutcome> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshTask = (async (): Promise<RefreshOutcome> => {
      try {
        const currentRefreshToken = refreshTokenRef.current || await AsyncStorage.getItem('user_refresh_token');
        console.log('[AUTH] Calling refresh token endpoint...');
        const outcome = await requestTokenRefresh(BASE_URL, currentRefreshToken);

        if (outcome.status === 'ok') {
          console.log('[AUTH] Access token refreshed successfully.');
          setTokens(outcome.accessToken, outcome.refreshToken);
          if (outcome.user) {
            setUserState(prev => ({ ...prev, ...outcome.user }));
            AsyncStorage.setItem('user_profile', JSON.stringify(outcome.user)).catch(e => console.error(e));
          }
        } else if (outcome.status === 'invalid') {
          console.warn('[AUTH] Refresh token rejected by server:', outcome.reason);
        } else {
          console.warn('[AUTH] Could not refresh token right now (keeping session):', outcome.reason);
        }
        return outcome;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshTask;
    return refreshTask;
  }, [setTokens]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const outcome = await refreshSession();
    return outcome.status === 'ok' ? outcome.accessToken : null;
  }, [refreshSession]);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const rawHeaders: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => { rawHeaders[key] = value; });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([k, v]) => { rawHeaders[k] = v; });
      } else {
        Object.assign(rawHeaders, options.headers);
      }
    }

    let activeToken = tokenRef.current || await AsyncStorage.getItem('user_token');
    const hasRefreshToken = !!(refreshTokenRef.current || await AsyncStorage.getItem('user_refresh_token'));

    // Refresh up front when the access token is (about to be) expired, instead of waiting for a 401
    if (hasRefreshToken && (!activeToken || isTokenExpired(activeToken))) {
      const outcome = await refreshSession();
      if (outcome.status === 'ok') {
        activeToken = outcome.accessToken;
      } else if (outcome.status === 'invalid') {
        handleSessionExpired();
      }
    }

    if (activeToken && !rawHeaders['Authorization']) {
      rawHeaders['Authorization'] = `Bearer ${activeToken}`;
    }

    let response = await fetch(url, { ...options, headers: rawHeaders });

    if (response.status === 401 && hasRefreshToken) {
      console.log(`[AUTH] 401 Unauthorized for ${url}. Attempting access token refresh...`);
      const outcome = await refreshSession();
      if (outcome.status === 'ok') {
        rawHeaders['Authorization'] = `Bearer ${outcome.accessToken}`;
        response = await fetch(url, { ...options, headers: rawHeaders });
      } else if (outcome.status === 'invalid') {
        // Only the refresh token being rejected ends the session - not an expired access token
        handleSessionExpired();
      }
      // 'transient': keep the session and return the 401; the next request retries the refresh
    }

    return response;
  }, [refreshSession, handleSessionExpired]);

  // Proactively refresh shortly before the access token expires, so screens that read `token`
  // directly always have a valid one. Transient failures are retried; a rejected refresh token ends the session.
  useEffect(() => {
    if (!token) return;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const delay = msUntilAccessTokenRefresh(token);
    if (delay === null) return;

    const runRefresh = async () => {
      const outcome = await refreshSession();
      if (outcome.status === 'invalid') {
        handleSessionExpired();
      } else if (outcome.status === 'transient') {
        retryTimer = setTimeout(runRefresh, 30 * 1000);
      }
    };
    const timer = setTimeout(runRefresh, delay);
    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [token, refreshSession, handleSessionExpired]);

  // Timers don't run while the app is in the background, so check again as soon as it comes back
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextState => {
      if (nextState !== 'active' || !refreshTokenRef.current) return;
      if (!tokenRef.current || isTokenExpired(tokenRef.current)) {
        const outcome = await refreshSession();
        if (outcome.status === 'invalid') handleSessionExpired();
      }
    });
    return () => subscription.remove();
  }, [refreshSession, handleSessionExpired]);

  const logout = useCallback(async () => {
    try {
      const activeRefreshToken = refreshTokenRef.current || await AsyncStorage.getItem('user_refresh_token');
      if (activeRefreshToken) {
        await fetch(`${BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: activeRefreshToken })
        }).catch(err => console.warn('Logout request warning:', err));
      }
    } finally {
      setTokens(null, null);
      setUser(null);
      resetToLogin();
    }
  }, [refreshToken, setTokens, setUser]);

  const refreshData = useCallback(async (activeToken?: string | null) => {
    const currentToken = activeToken !== undefined ? activeToken : token;
    if (!currentToken) {
      console.log('[DATA CONTEXT] Skipping data fetch: No token provided.');
      return;
    }
    try {
      console.log(`[DATA CONTEXT] Fetching data from: ${BASE_URL}`);

      const decoded = decodeToken(currentToken);
      const role = decoded?.role || 'customer';
      const customerId = decoded?.customerId;

      console.log(`[DATA CONTEXT] Fetching data for role: ${role}`);

      if (role === 'admin') {
        // Super Admin: fetches all garages, all platform customers, all vehicles, and all audit logs (no garage alerts/reminders)
        const [garagesRes, customersRes, vehiclesRes, auditsRes] = await Promise.all([
          authFetch(`${BASE_URL}/garages`),
          authFetch(`${BASE_URL}/customers`),
          authFetch(`${BASE_URL}/vehicles`),
          authFetch(`${BASE_URL}/audit`),
        ]);

        if (garagesRes.ok) {
          const garagesData = await garagesRes.json();
          setGarages(garagesData);
        }
        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData);
        }
        if (vehiclesRes.ok) {
          const vehiclesData = await vehiclesRes.json();
          setVehicles(vehiclesData);
        }
        if (auditsRes.ok) {
          const auditsData = await auditsRes.json();
          setAudits(auditsData);
        }
        setAlerts([]); // Super Admin has no personal garage action alerts
      } else if (role === 'staff' || role === 'garage_admin') {
        const activeGarageId = decoded?.garageId || user?.garageId;
        const fetchPromises: Promise<Response>[] = [
          authFetch(`${BASE_URL}/customers`),
          authFetch(`${BASE_URL}/vehicles`),
          authFetch(`${BASE_URL}/audit`),
          authFetch(`${BASE_URL}/alerts`),
        ];

        if (activeGarageId) {
          fetchPromises.push(authFetch(`${BASE_URL}/garages/${activeGarageId}`));
        }

        const results = await Promise.all(fetchPromises);
        const customersRes = results[0];
        const vehiclesRes = results[1];
        const auditsRes = results[2];
        const alertsRes = results[3];
        const garageRes = results[4];

        if (customersRes && customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData);
        }
        if (vehiclesRes && vehiclesRes.ok) {
          const vehiclesData = await vehiclesRes.json();
          setVehicles(vehiclesData);
        }
        if (auditsRes && auditsRes.ok) {
          const auditsData = await auditsRes.json();
          setAudits(auditsData);
        }
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json();
          const filteredAlerts = activeGarageId
            ? alertsData.filter((a: any) => !a.garageId || String(a.garageId) === String(activeGarageId))
            : alertsData;
          setAlerts(filteredAlerts);
        }
        if (garageRes && garageRes.ok) {
          const garageData = await garageRes.json();
          setCurrentGarage(garageData);
        }
      } else {
        // Customer: only fetch their own customer profile (which includes vehicles) and their alerts
        const promises = [
          authFetch(`${BASE_URL}/alerts`)
        ];
        if (customerId) {
          promises.push(authFetch(`${BASE_URL}/customers/${customerId}`));
        }

        const [alertsRes, customerRes] = await Promise.all(promises);

        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlerts(alertsData);
        }
        if (customerRes && customerRes.ok) {
          const customerData = await customerRes.json();
          setCustomers([customerData]);
          setVehicles(customerData.vehicles || []);
        }
        setAudits([]); // Clear audits for customer
      }
    } catch (error) {
      console.error('[DATA CONTEXT] Error fetching backend data:', error);
    }
  }, [token, user?.garageId, authFetch]);

  // Read stored tokens on mount
  useEffect(() => {
    const initTokens = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('user_token');
        const storedRefreshToken = await AsyncStorage.getItem('user_refresh_token');
        const storedUserJson = await AsyncStorage.getItem('user_profile');

        if (storedToken && !token) {
          tokenRef.current = storedToken;
          setTokenState(storedToken);
        }
        if (storedRefreshToken && !refreshToken) {
          refreshTokenRef.current = storedRefreshToken;
          setRefreshTokenState(storedRefreshToken);
        }
        if (storedUserJson && !user) {
          setUserState(JSON.parse(storedUserJson));
        }
      } catch (e) {
        console.warn('Error reading stored tokens in DataContext:', e);
      }
    };
    initTokens();
  }, []);

  useEffect(() => {
    fetchServiceCategories();
    if (token) {
      refreshData();
    }
  }, [token]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdDate'>): Promise<string> => {
    try {
      const response = await authFetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }
      await refreshData();
      return data.customer?.id || data.customer?._id || data.id || data._id || `c_${Date.now()}`;
    } catch (error) {
      console.error('[DATA CONTEXT] addCustomer error:', error);
      throw error;
    }
  };

  const addVehicle = async (vehicleData: Omit<Vehicle, 'id'>): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/vehicles`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add vehicle');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] addVehicle error:', error);
      throw error;
    }
  };

  const updateVehicleStatus = async (vehicleId: string, status: 'Active' | 'Sold' | 'Scrapped' | 'Pending'): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update vehicle status');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] updateVehicleStatus error:', error);
      throw error;
    }
  };

  const addAlert = async (alertData: Omit<AlertNotification, 'id' | 'status' | 'date'> & { status?: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected', date?: string }): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] addAlert error:', error);
      throw error;
    }
  };

  const approveAlert = async (alertId: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/approve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] approveAlert error:', error);
      throw error;
    }
  };

  const acknowledgeAlert = async (alertId: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to acknowledge notification');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] acknowledgeAlert error:', error);
      throw error;
    }
  };

  const addAudit = async (activity: string, details: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/audit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activity, details })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to log audit activity');
      }
      await refreshData();
    } catch (error) {
      // Audit logging is best-effort: never turn an action that already succeeded into an error for the user
      console.warn('[DATA CONTEXT] addAudit failed (action itself was not affected):', error);
    }
  };

  const createStaffAccount = async (name: string, email: string, password: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/auth/create-staff`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create staff account');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] createStaffAccount error:', error);
      throw error;
    }
  };

  const fetchStaffList = async (): Promise<any[]> => {
    const decoded = decodeToken(token);
    const role = decoded?.role || user?.role || 'customer';
    if (role !== 'garage_admin') {
      console.log('[DATA CONTEXT] Skipping staff list fetch: Insufficient permissions (role is not garage_admin).');
      return [];
    }

    try {
      const response = await authFetch(`${BASE_URL}/auth/staff`, {
        method: 'GET',
        headers: { 
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch staff list');
      }
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] fetchStaffList error:', error);
      throw error;
    }
  };

  const deleteStaffAccount = async (staffId: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/auth/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete staff account');
      }
    } catch (error) {
      console.error('[DATA CONTEXT] deleteStaffAccount error:', error);
      throw error;
    }
  };

  const rescheduleBooking = async (alertId: string, date: string, slot?: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/reschedule`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date, slot })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reschedule booking');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] rescheduleBooking error:', error);
      throw error;
    }
  };

  const cancelBooking = async (alertId: string, reason?: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/cancel`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason || '' })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel booking');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] cancelBooking error:', error);
      throw error;
    }
  };

  const rejectAlert = async (alertId: string, reason: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/alerts/${alertId}/reject`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject booking request');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] rejectAlert error:', error);
      throw error;
    }
  };

  const lookupVehicle = async (vrn: string): Promise<any> => {
    let timeoutId: any = null;
    try {
      // authFetch adds the (refreshed) access token
      const headers: Record<string, string> = {};
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await authFetch(`${BASE_URL}/vehicles/dvla/${encodeURIComponent(vrn)}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let data: any = {};
      try {
        data = await response.json();
      } catch (jsonErr) {
        // If server returned non-JSON (like 502/503/504 HTML error page)
        const busyErr: any = new Error('Government DVSA API is busy, please check again.');
        busyErr.isBusy = true;
        throw busyErr;
      }

      if (!response.ok) {
        // 404 Not Found or explicit VRN invalid -> Vehicle genuinely not found in DVSA registry
        if (
          response.status === 404 ||
          (response.status === 400 && data.error && (
            data.error.toLowerCase().includes('not found') ||
            data.error.toLowerCase().includes('invalid uk registration') ||
            data.error.toLowerCase().includes('invalid')
          ))
        ) {
          const notFoundErr: any = new Error('Vehicle details not found. Please check the registration plate and try again.');
          notFoundErr.isNotFound = true;
          throw notFoundErr;
        }

        // ANY 5xx status (500, 502, 503, 504) or DVSA/busy/unavailable error message -> DVSA is busy
        if (
          response.status >= 500 ||
          (data.error && (
            data.error.toLowerCase().includes('busy') ||
            data.error.toLowerCase().includes('dvsa') ||
            data.error.toLowerCase().includes('unavailable') ||
            data.error.toLowerCase().includes('timeout') ||
            data.error.toLowerCase().includes('temporarily')
          ))
        ) {
          const busyErr: any = new Error('Government DVSA API is busy, please check again.');
          busyErr.isBusy = true;
          throw busyErr;
        }

        const notFoundErr: any = new Error(data.error || 'Vehicle details not found. Please check the registration plate and try again.');
        notFoundErr.isNotFound = true;
        throw notFoundErr;
      }
      return data;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('[DATA CONTEXT] lookupVehicle error:', error);
      if (error.isNotFound || error.isBusy) {
        throw error;
      }

      const errMsg = (error?.message || '').toLowerCase();
      const errName = (error?.name || '').toLowerCase();
      const isNetworkFailure =
        errName === 'aborterror' ||
        errMsg.includes('network request failed') ||
        errMsg.includes('network') ||
        errMsg.includes('timeout') ||
        errMsg.includes('timed out') ||
        errMsg.includes('socket') ||
        errMsg.includes('connection') ||
        errMsg.includes('connect') ||
        errMsg.includes('fetch') ||
        errMsg.includes('offline') ||
        errMsg.includes('abort') ||
        errMsg.includes('failed to fetch') ||
        errMsg.includes('econnrefused') ||
        errMsg.includes('etimedout') ||
        errMsg.includes('json');

      if (isNetworkFailure) {
        const busyErr: any = new Error('Government DVSA API is busy, please check again.');
        busyErr.isBusy = true;
        throw busyErr;
      }

      // Default safe fallback for DVSA live lookup failures
      const busyErr: any = new Error('Government DVSA API is busy, please check again.');
      busyErr.isBusy = true;
      throw busyErr;
    }
  };

  const fetchGarages = async (): Promise<Garage[]> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages`, {
        headers: {
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch garages');
      }
      setGarages(data);
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] fetchGarages error:', error);
      throw error;
    }
  };

  const updateGarageStatus = async (garageId: string, status: string, verificationStatus?: string, rejectionReason?: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, verificationStatus, rejectionReason })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update garage status');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] updateGarageStatus error:', error);
      throw error;
    }
  };

  const updateGarageDocumentStatus = async (garageId: string, docId: string, status: 'Verified' | 'Rejected' | 'Pending', rejectionReason?: string): Promise<any> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/documents/${docId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, rejectionReason })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update document status');
      }
      await refreshData();
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] updateGarageDocumentStatus error:', error);
      throw error;
    }
  };

  const updateGarageProfile = async (garageId: string, updates: Partial<Garage>): Promise<any> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update garage profile');
      }
      await refreshData();
      return data.garage;
    } catch (error) {
      console.error('[DATA CONTEXT] updateGarageProfile error:', error);
      throw error;
    }
  };

  const fetchCurrentGarage = async (): Promise<Garage | null> => {
    const garageId = user?.garageId || (decodeToken(token)?.garageId);
    if (!garageId) return null;
    try {
      const res = await authFetch(`${BASE_URL}/garages/${garageId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentGarage(data);
        return data;
      }
    } catch (e) {
      console.error('[DATA CONTEXT] fetchCurrentGarage error:', e);
    }
    return null;
  };

  const uploadGarageDocument = async (garageId: string, documentName: string, fileUrl: string, documentType?: string) => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/upload-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentName, fileUrl, documentType })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload document');
      }
      await fetchCurrentGarage();
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] uploadGarageDocument error:', error);
      throw error;
    }
  };

  const submitCurrentGarageForReview = async () => {
    try {
      const garageId = user?.garageId || (decodeToken(token)?.garageId);
      if (!garageId) throw new Error('No garage associated with this account');
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/submit-for-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit garage for review');
      }
      await fetchCurrentGarage();
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] submitCurrentGarageForReview error:', error);
      throw error;
    }
  };

  const fetchGarageServices = useCallback(async (garageId: string): Promise<any> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/services`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch services');
      }
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] fetchGarageServices error:', error);
      throw error;
    }
  }, [authFetch]);

  const fetchServiceCatalogTemplates = async (): Promise<{ categories: string[]; templates: any[] }> => {
    try {
      const response = await fetch(`${BASE_URL}/garages/templates/catalog`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch catalog templates');
      }
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] fetchServiceCatalogTemplates error:', error);
      return {
        categories: ['MOT', 'Servicing', 'Repairs', 'Tyre replacement', 'Diagnostics', 'Brakes', 'Exhaust', 'Custom'],
        templates: [
          { name: 'MOT Test (Class 4)', category: 'MOT', price: 45, duration: 45, description: 'Standard Class 4 MOT Test for cars and light vans.' },
          { name: 'Full Service', category: 'Servicing', price: 155, duration: 120, description: 'Comprehensive 50+ point inspection & fluid change.' },
          { name: 'Interim Service', category: 'Servicing', price: 85, duration: 60, description: 'Essential oil & filter replacement with 25-point safety check.' },
          { name: 'Engine Diagnostic & Scan', category: 'Diagnostics', price: 50, duration: 45, description: 'Full OBD2 computerized diagnostics scan.' },
          { name: 'Front Brake Pads & Discs', category: 'Brakes', price: 130, duration: 60, description: 'Supply & fitment of front brake pads & discs.' },
          { name: 'Tyre Replacement & Balancing', category: 'Tyre replacement', price: 65, duration: 45, description: 'New tyre supply, fitment, and precision balancing.' },
          { name: 'Exhaust Inspection & Repair', category: 'Exhaust', price: 75, duration: 60, description: 'Exhaust leak detection and silencer repair.' }
        ]
      };
    }
  };

  const addGarageService = async (garageId: string, serviceData: any): Promise<any> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceData)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add service');
      }
      await refreshData();
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] addGarageService error:', error);
      throw error;
    }
  };

  const updateGarageService = async (garageId: string, serviceId: string, updates: any): Promise<any> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/services/${serviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update service');
      }
      await refreshData();
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] updateGarageService error:', error);
      throw error;
    }
  };

  const deleteGarageService = async (garageId: string, serviceId: string): Promise<any> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/services/${serviceId}`, {
        method: 'DELETE',
        headers: {
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete service');
      }
      await refreshData();
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] deleteGarageService error:', error);
      throw error;
    }
  };

  const seedGarageDefaultServices = async (garageId: string): Promise<any> => {
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}/services/seed-defaults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize default services');
      }
      await refreshData();
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] seedGarageDefaultServices error:', error);
      throw error;
    }
  };

  const fetchServiceCategories = useCallback(async (): Promise<ServiceCategory[]> => {
    try {
      const response = await authFetch(`${BASE_URL}/service-categories`);
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data.categories) ? data.categories : [];
        setServiceCategories(list);
        return list;
      }
      return [];
    } catch (error) {
      console.error('[DATA CONTEXT] fetchServiceCategories error:', error);
      return [];
    }
  }, [authFetch]);

  const createServiceCategory = useCallback(async (catData: Partial<ServiceCategory>): Promise<ServiceCategory> => {
    try {
      const response = await authFetch(`${BASE_URL}/service-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(catData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create service category');
      }
      await fetchServiceCategories();
      return data.category;
    } catch (error) {
      console.error('[DATA CONTEXT] createServiceCategory error:', error);
      throw error;
    }
  }, [authFetch, fetchServiceCategories]);

  const deleteServiceCategory = useCallback(async (categoryId: string): Promise<void> => {
    try {
      const response = await authFetch(`${BASE_URL}/service-categories/${categoryId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete service category');
      }
      await fetchServiceCategories();
    } catch (error) {
      console.error('[DATA CONTEXT] deleteServiceCategory error:', error);
      throw error;
    }
  }, [authFetch, fetchServiceCategories]);

  return (
    <DataContext.Provider
      value={{
        customers,
        vehicles,
        alerts,
        audits,
        garages,
        serviceCategories,
        fetchServiceCategories,
        createServiceCategory,
        deleteServiceCategory,
        token,
        refreshToken,
        setToken,
        setRefreshToken,
        setTokens,
        refreshAccessToken,
        refreshSession,
        authFetch,
        logout,
        user,
        setUser,
        refreshData,
        addCustomer,
        addVehicle,
        updateVehicleStatus,
        addAlert,
        approveAlert,
        acknowledgeAlert,
        rejectAlert,
        addAudit,
        createStaffAccount,
        fetchStaffList,
        deleteStaffAccount,
        rescheduleBooking,
        cancelBooking,
        lookupVehicle,
        fetchGarages,
        updateGarageStatus,
        updateGarageDocumentStatus,
        updateGarageProfile,
        currentGarage,
        fetchCurrentGarage,
        uploadGarageDocument,
        submitCurrentGarageForReview,
        fetchGarageServices,
        fetchServiceCatalogTemplates,
        addGarageService,
        updateGarageService,
        deleteGarageService,
        seedGarageDefaultServices,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useAppValues = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppValues must be used within a DataProvider');
  }
  return context;
};
