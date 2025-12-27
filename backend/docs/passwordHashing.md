# Password Hashing Implementation

This document explains how password hashing is implemented in the SAVX store application.

## Overview

The application uses **bcrypt** for secure password hashing and verification. Bcrypt is a widely-used, secure password hashing algorithm that automatically handles salt generation and provides configurable work factors.

## Security Features

- **Automatic Salt Generation**: Each password gets a unique salt
- **Configurable Work Factor**: Set to 12 rounds for optimal security/performance balance
- **Built-in Resistance**: Protects against rainbow table and brute force attacks

## Implementation Files

### 1. Password Utilities (`backend/utils/passwordUtils.js`)

Core functions for password operations:

```javascript
const { hashPassword, comparePassword, generateRandomPassword } = require('../utils/passwordUtils');

// Hash a password
const hashedPassword = await hashPassword('plainTextPassword');

// Compare passwords
const isValid = await comparePassword('plainTextPassword', hashedPassword);

// Generate random password
const randomPassword = generateRandomPassword(12);
```

### 2. Database Initialization (`backend/database/init.js`)

Admin user seeding now uses hashed passwords:

```javascript
const hashedPassword = await hashPassword('admin123');
// Store hashedPassword in database
```

### 3. Authentication Routes (`backend/routes/auth.js`)

Updated signup and login endpoints:

- **Signup**: Hashes passwords before storage
- **Login**: Compares provided password with stored hash
- **Google Auth**: Maintains existing flow with 'GOOGLE_AUTH' placeholder

### 4. Migration Script (`backend/scripts/migratePasswords.js`)

One-time script to convert existing plain text passwords to hashed passwords.

## Usage Instructions

### Initial Setup

1. Install bcrypt dependency:
```bash
npm install bcrypt@5.1.1
```

2. Restart the application - new admin user will be created with hashed password

### Migration for Existing Users

If you have existing users with plain text passwords:

```bash
# Run the migration script
node backend/scripts/migratePasswords.js
```

This will:
- Find all users with plain text passwords
- Hash each password using bcrypt
- Update database records with hashed passwords
- Skip already hashed passwords and Google auth users

### Authentication Flow

#### User Registration
1. User submits password (minimum 8 characters)
2. Password is validated for length
3. Password is hashed using bcrypt
4. Hashed password is stored in database

#### User Login
1. User submits email and password
2. User record is fetched by email
3. Submitted password is compared with stored hash
4. Access granted only if passwords match

#### Google Sign-In
- Uses existing Google OAuth flow
- Stores 'GOOGLE_AUTH' placeholder as password
- Login redirects Google users to use Google Sign-In

## Security Considerations

### Password Requirements
- Minimum 8 characters
- No other restrictions (can be strengthened as needed)

### Hash Configuration
- **Salt Rounds**: 12 (configurable in `passwordUtils.js`)
- **Hash Length**: 60 characters
- **Algorithm**: bcrypt

### Database Storage
- Hashed passwords stored as TEXT
- Plain text passwords never stored
- Passwords excluded from API responses

## Admin Access

**Default Admin Credentials:**
- Email: `admin@SAVX.com`
- Password: `admin123`

**Important**: The admin password is hashed during database initialization. For production, change this password immediately after first login.

## Testing

To verify the implementation:

1. Create a new user account
2. Verify you can login with the credentials
3. Check database - password should be 60 characters long
4. Try incorrect password - should be rejected

## Troubleshooting

### Common Issues

1. **"Password hashing failed" error**
   - Check bcrypt installation
   - Verify sufficient system resources

2. **Login fails after migration**
   - Ensure migration completed successfully
   - Check for duplicate email addresses

3. **Performance issues**
   - Consider reducing salt rounds if needed
   - Monitor server response times

### Migration Issues

If migration fails:
- Check database connectivity
- Verify user permissions
- Review error logs for specific issues

## Future Enhancements

Consider implementing:
- Password strength requirements
- Password reset functionality
- Account lockout after failed attempts
- Two-factor authentication
- Password expiration policies
