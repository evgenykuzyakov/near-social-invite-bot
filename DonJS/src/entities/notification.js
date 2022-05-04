const Account = require("./account"),
	Status = require("./status");

class Notification {
	constructor(data) {
		this.id = data.id;
		this.type = data.type;
		this.createdAt = data.created_at;
		this.account = new Account(data.account);
		this.status = data.status == null ? null : new Status(data.status);
	}
}

module.exports = Notification;
