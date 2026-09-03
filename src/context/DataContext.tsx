import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  type: 'NEW_VEHICLE' | 'SOLD' | 'BOOKED';
  customerName: string;
  customerId: string;
  registrationNumber: string;
  makeModel: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Acknowledged' | 'Rejected';
  rejectionReason?: string;
  garageId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  slotTime?: string;
  slotNumber?: number;
  stationId?: string;
  stationName?: string;
  rescheduled?: boolean;
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
  email: string;
  phone: string;
  openingTime?: string;
  closingTime?: string;
  description?: string;
  services?: any[];
  workingDays?: string[];
  slots?: string[];
  verificationStatus?: 'Pending' | 'Verified' | 'Rejected';
  verificationDocuments?: { name: string; fileUrl: string; uploadDate?: string }[];
  rating?: number;
  distance?: number;
  status: 'Approved' | 'Pending' | 'Suspended' | 'Rejected';
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

interface DataContextType {
  customers: Customer[];
  vehicles: Vehicle[];
  alerts: AlertNotification[];
  audits: AuditLog[];
  garages: Garage[];
  token: string | null;
  setToken: (token: string | null) => void;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  refreshData: () => Promise<void>;
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
  rescheduleBooking: (alertId: string, date: string, slot: string) => Promise<void>;
  lookupVehicle: (vrn: string) => Promise<any>;
  fetchGarages: () => Promise<Garage[]>;
  updateGarageStatus: (garageId: string, status: string, verificationStatus?: string) => Promise<void>;
  updateGarageProfile: (garageId: string, updates: Partial<Garage>) => Promise<any>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const BASE_URL = 'http://localhost:5000/api';

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
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<UserProfile | null>(null);

  const setUser = (newUser: UserProfile | null) => {
    setUserState(newUser);
    if (newUser) {
      AsyncStorage.setItem('user_profile', JSON.stringify(newUser)).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_profile').catch(err => console.error(err));
    }
  };

  const refreshData = async (activeToken?: string | null) => {
    const currentToken = activeToken !== undefined ? activeToken : token;
    if (!currentToken) {
      console.log('[DATA CONTEXT] Skipping data fetch: No token provided.');
      return;
    }
    try {
      console.log(`[DATA CONTEXT] Fetching data from: ${BASE_URL}`);
      const headers = {
        'Authorization': `Bearer ${currentToken}`
      };

      const decoded = decodeToken(currentToken);
      const role = decoded?.role || 'customer';
      const customerId = decoded?.customerId;

      console.log(`[DATA CONTEXT] Fetching data for role: ${role}`);

      if (role === 'admin') {
        // Super Admin: fetches all garages, all platform customers, all vehicles, and all audit logs (no garage alerts/reminders)
        const [garagesRes, customersRes, vehiclesRes, auditsRes] = await Promise.all([
          fetch(`${BASE_URL}/garages`, { headers }),
          fetch(`${BASE_URL}/customers`, { headers }),
          fetch(`${BASE_URL}/vehicles`, { headers }),
          fetch(`${BASE_URL}/audit`, { headers }),
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
        const [customersRes, vehiclesRes, auditsRes, alertsRes] = await Promise.all([
          fetch(`${BASE_URL}/customers`, { headers }),
          fetch(`${BASE_URL}/vehicles`, { headers }),
          fetch(`${BASE_URL}/audit`, { headers }),
          fetch(`${BASE_URL}/alerts`, { headers }),
        ]);

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
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          const garageId = decoded?.garageId;
          const filteredAlerts = garageId
            ? alertsData.filter((a: any) => !a.garageId || String(a.garageId) === String(garageId))
            : alertsData;
          setAlerts(filteredAlerts);
        }
      } else {
        // Customer: only fetch their own customer profile (which includes vehicles) and their alerts
        const promises = [
          fetch(`${BASE_URL}/alerts`, { headers })
        ];
        if (customerId) {
          promises.push(fetch(`${BASE_URL}/customers/${customerId}`, { headers }));
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
  };

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      AsyncStorage.setItem('user_token', newToken).catch(err => console.error(err));
    } else {
      AsyncStorage.removeItem('user_token').catch(err => console.error(err));
      AsyncStorage.removeItem('user_profile').catch(err => console.error(err));
      setCustomers([]);
      setVehicles([]);
      setAudits([]);
      setAlerts([]);
      setGarages([]);
    }
  };

  useEffect(() => {
    if (token) {
      refreshData();
    }
  }, [token]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdDate'>): Promise<string> => {
    try {
      const response = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const response = await fetch(`${BASE_URL}/vehicles`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const response = await fetch(`${BASE_URL}/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const response = await fetch(`${BASE_URL}/alerts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const response = await fetch(`${BASE_URL}/alerts/${alertId}/approve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const response = await fetch(`${BASE_URL}/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const response = await fetch(`${BASE_URL}/audit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activity, details })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to log audit activity');
      }
      await refreshData();
    } catch (error) {
      console.error('[DATA CONTEXT] addAudit error:', error);
      throw error;
    }
  };

  const createStaffAccount = async (name: string, email: string, password: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/auth/create-staff`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const response = await fetch(`${BASE_URL}/auth/staff`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`
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
      const response = await fetch(`${BASE_URL}/auth/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
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

  const rescheduleBooking = async (alertId: string, date: string, slot: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/alerts/${alertId}/reschedule`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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

  const rejectAlert = async (alertId: string, reason: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/alerts/${alertId}/reject`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
    try {
      const response = await fetch(`${BASE_URL}/vehicles/dvla/${encodeURIComponent(vrn)}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to lookup vehicle');
      }
      return data;
    } catch (error) {
      console.error('[DATA CONTEXT] lookupVehicle error:', error);
      throw error;
    }
  };

  const fetchGarages = async (): Promise<Garage[]> => {
    try {
      const response = await fetch(`${BASE_URL}/garages`, {
        headers: {
          'Authorization': `Bearer ${token}`
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

  const updateGarageStatus = async (garageId: string, status: string, verificationStatus?: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/garages/${garageId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, verificationStatus })
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

  const updateGarageProfile = async (garageId: string, updates: Partial<Garage>): Promise<any> => {
    try {
      const response = await fetch(`${BASE_URL}/garages/${garageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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

  return (
    <DataContext.Provider
      value={{
        customers,
        vehicles,
        alerts,
        audits,
        garages,
        token,
        setToken,
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
        lookupVehicle,
        fetchGarages,
        updateGarageStatus,
        updateGarageProfile,
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
