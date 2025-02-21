
const config = require('../config');

class PermissionChecker {
    static hasPermission(member, command) {
        // If no member object (DM), only allow certain commands
        if (!member || !member.roles) {
            const dmAllowedCommands = ['hlp', 'skulls'];
            return dmAllowedCommands.includes(command);
        }
        
        // Admin role has access to everything
        if (member.roles.cache.has(config.adminRoleId)) {
            return true;
        }

        // Check moderator permissions for lottery creation
        if (['sd', 'rsd', 'cnl', 'rm', 'draw'].includes(command)) {
            return member.roles.cache.has(config.administratorRoleId);
        }

        // Allow everyone to use other commands
        return true;
    }

    static getHighestRole(member) {
        if (member.roles.cache.has(config.adminRoleId)) return 'admin';
        if (member.roles.cache.has(config.moderatorRoleId)) return 'moderator';
        return 'none';
    }

    static getMissingPermissionMessage(command) {
        return `You need Moderator or Admin role to use the \`${command}\` command.`;
    }
}

module.exports = PermissionChecker;
