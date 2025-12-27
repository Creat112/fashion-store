const { getDB } = require('../database/init');
const { hashPassword } = require('../utils/passwordUtils');

/**
 * Migration script to hash existing plain text passwords
 * Run this once to migrate existing users to hashed passwords
 */
async function migratePasswords() {
    console.log('Starting password migration...');
    
    const db = getDB();
    
    // Get all users with plain text passwords (not already hashed and not Google auth)
    db.all("SELECT id, email, password FROM users WHERE password != 'GOOGLE_AUTH'", async (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err);
            return;
        }
        
        console.log(`Found ${rows.length} users to migrate`);
        
        for (const user of rows) {
            try {
                // Check if password is already hashed (bcrypt hashes are 60 characters long)
                if (user.password.length === 60) {
                    console.log(`User ${user.email} already has hashed password, skipping...`);
                    continue;
                }
                
                // Hash the plain text password
                const hashedPassword = await hashPassword(user.password);
                
                // Update the user record with hashed password
                db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id], (err) => {
                    if (err) {
                        console.error(`Error updating user ${user.email}:`, err);
                    } else {
                        console.log(`Successfully migrated user: ${user.email}`);
                    }
                });
                
            } catch (error) {
                console.error(`Error migrating user ${user.email}:`, error);
            }
        }
        
        console.log('Password migration completed');
    });
}

// Run migration if this script is executed directly
if (require.main === module) {
    migratePasswords();
}

module.exports = { migratePasswords };
