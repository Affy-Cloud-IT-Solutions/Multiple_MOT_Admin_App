 
export const validateFirstName = (firstName) => {
  const sanitized = firstName.replace(/[^A-Za-z]/g, '');
  if (!sanitized.trim()) return { error: 'First name is required.', value: sanitized };
  if (!/^[A-Za-z]+$/.test(sanitized)) return { error: 'First name must contain only letters.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validateLastName = (lastName) => {
  const sanitized = lastName.replace(/[^A-Za-z]/g, '');
  if (!sanitized.trim()) return { error: 'Last name is required.', value: sanitized };
  if (!/^[A-Za-z]+$/.test(sanitized)) return { error: 'Last name must contain only letters.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validatePhoneNumber = (phoneNumber) => {
  const sanitized = phoneNumber.replace(/[^0-9]/g, '');
  if (!sanitized.trim()) return { error: 'Phone number is required.', value: sanitized };
  if (!/^\d{10}$/.test(sanitized)) return { error: 'Phone number must be 10 digits only.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validateEmail = (email) => {
  const sanitized = email.trim(); // no special sanitization
  if (!sanitized) return { error: 'Email is required.', value: sanitized };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) return { error: 'Enter a valid email address.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validatePassword = (password) => {
  const sanitized = password.trim(); // no special sanitization
  if (!sanitized) return { error: 'Password is required.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validateMotExpiryDate = (dateStr) => {
  if (!dateStr || !dateStr.trim()) {
    return { error: 'MOT Expiry Date is required.', value: dateStr };
  }
  
  const reg = /^\d{4}-\d{2}-\d{2}$/;
  if (!reg.test(dateStr)) {
    return { error: 'Date must be in YYYY-MM-DD format.', value: dateStr };
  }
  
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  if (month < 1 || month > 12) {
    return { error: 'Month must be between 01 and 12.', value: dateStr };
  }
  
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (isLeapYear) {
    daysInMonth[1] = 29;
  }
  
  const maxDays = daysInMonth[month - 1];
  if (day < 1 || day > maxDays) {
    return { 
      error: `Day must be between 01 and ${String(maxDays).padStart(2, '0')} for month ${String(month).padStart(2, '0')}.`, 
      value: dateStr 
    };
  }
  
  return { error: '', value: dateStr };
};
