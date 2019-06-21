const Discord = require('discord.js');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);
const settings = require('./settings.json');

db.defaults({
    users: [],
    keys: []
}).write();

class AuthBot {
    constructor(options) {
        this.guildId = options.guild;
        this.prefix = options.prefix;
        this.token = options.token;
        this.verifiedRoleName = options.verifiedRoleName;
        this.unverifiedRoleName = options.unverifiedRoleName;
        this.authorizedRoles = options.authorizedRoles;
        this._bot = new Discord.Client();
    }
    start() {
        this._bot.login(this.token);
        this._bot.on('ready', () => console.log('Ready!'));
        this._bot.on('message', msg => this._handleMessage(msg));
        setInterval(() => this._removeVerified(), 5000);
    }

    _handleMessage(msg) {
        if (!msg.channel.type.trim() === 'dm') return;
        const guild = this._bot.guilds.find(guild => guild.id === this.guildId);
        const args = msg.content.split(' ');
        const masterRole = guild.members.find(member => member.id === msg.author.id).roles.find(role => this.authorizedRoles.includes(role.name));
        if (msg.content.startsWith(this.prefix + 'generate') && masterRole) {
            let numOfKeys = 1;
            let totalKeys = '';
            if (args.length === 2) numOfKeys = parseInt(args[1]);
            for (let i = 0; i < numOfKeys; i++) {
                const key = this._makeKey();
                totalKeys += key + (i === numOfKeys - 1 ? '' : '\n');
                db.get('keys').push({
                    key
                }).write();
            }
            msg.reply(totalKeys);
        }
        if (msg.content.startsWith(this.prefix + 'activate')) {
            let allKeys = db.get('keys').value();
            let valid = false;
            for (let i = 0; i < allKeys.length; i++) {
                if (allKeys[i].key === args[1]) {
                    allKeys.splice(i, 1);
                    valid = true;
                }
            }
            if (valid) {
                if (this.unverifiedRoleName !== null) {
                    let unverRole = guild.roles.find(role => role.name === this.unverifiedRoleName);
                    guild.member(msg.author).removeRole(unverRole);
                }
                let verRole = guild.roles.find(role => role.name === this.verifiedRoleName);
                guild.member(msg.author).addRole(verRole);
                db.set('keys', allKeys).write();
                let expiry = new Date();
                expiry.setMonth(expiry.getMonth() + 1);
                db.get('users').push({
                    key: args[1],
                    id: msg.author.id,
                    expiry
                }).write();
                msg.reply('Your key has been successfully verified.');
            } else {
                msg.reply('Invalid key.');
            }
        }
    }

    _removeVerified() {
        let allUsers = db.get('users').value();
        const guild = this._bot.guilds.find(guild => guild.id === this.guildId);
        for (let i = 0; i < allUsers.length; i++) {
            let user = allUsers[i];
            if (Date.now() > Date.parse(user.expiry)) {
                if (this.unverifiedRoleName !== null) {
                    let unverRole = guild.roles.find(role => role.name === this.unverifiedRoleName);
                    guild.member(user.id).addRole(unverRole);
                }
                let verRole = guild.roles.find(role => role.name === this.verifiedRoleName);
                guild.member(user.id).removeRole(verRole);
                allUsers.splice(i, 1);
            }
        }
        db.set('users', allUsers).write();
    }

    _makeKey() {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < 29; i++) {
            text += (i + 1) % 6 !== 0 ? possible.charAt(Math.floor(Math.random() * possible.length)).toUpperCase() : '-';
        }
        return text;
    }
}

let bot = new AuthBot(settings);
bot.start();