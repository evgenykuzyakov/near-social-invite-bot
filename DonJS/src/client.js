const axios = require("axios"),
  Status = require("./entities/status"),
  Account = require("./entities/account"),
  Attachment = require("./entities/attachment"),
  formData = require("form-data"),
  Notification = require("./entities/notification"),
  EventEmitter = require("events");

let instance;

class Client extends EventEmitter {
  constructor(token, apiUrl) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    instance = this;
  }

  listenForStatuses() {
    const wsurl = this.apiUrl.startsWith("https://")
      ? this.apiUrl.replace("https://", "wss://")
      : `wss://${this.apiUrl}`;
    const ws = new (require("ws"))(
      `${wsurl}/api/v1/streaming?access_token=${this.token}&stream=public`
    );
    ws.on("message", (data) => {
      const dataObject = JSON.parse(data);
      if (dataObject.event == "update") {
        this.emit("onStatus", new Status(JSON.parse(dataObject.payload)));
      } else if (dataObject.event == "delete") {
        this.emit("onStatusDelete", dataObject.payload);
      }
    });
    ws.on("open", () => {
      this.emit("ready", { type: "statuses" });
    });
    ws.on("error", (error) => {
      throw error;
    });
  }

  listenForNotifications() {
    const wsurl = this.apiUrl.startsWith("https://")
      ? this.apiUrl.replace("https://", "wss://")
      : `wss://${this.apiUrl}`;
    const ws = new (require("ws"))(
      `${wsurl}/api/v1/streaming?access_token=${this.token}&stream=user`
    );
    ws.on("message", (data) => {
      const dataObject = JSON.parse(data);
      if (dataObject.event == "notification") {
        this.emit(
          "onNotification",
          new Notification(JSON.parse(dataObject.payload))
        );
      }
    });
    ws.on("open", () => {
      this.emit("ready", { type: "notification" });
    });
    ws.on("close", () => {
      console.log("Connection closed. Reconnecting");
      this.listenForNotifications();
    });
    ws.on("error", (error) => {
      throw error;
    });
  }

  static getInstance() {
    return instance;
  }

  async sendStatus(
    status,
    attachments = null,
    sensitive = false,
    spoiler = false
  ) {
    const mediasID = attachments === null ? [] : attachments.map((x) => x.id);
    const request = {
      method: "POST",
      url: `${this.apiUrl}/api/v1/statuses`,
      data: { status, sensitive, spoiler_text: spoiler, media_ids: mediasID },
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    };
    try {
      const status = await axios(request);
      return new Status(status.data);
    } catch (expect) {
      throw expect;
    }
  }

  async getClientAccount() {
    const request = {
      method: "GET",
      url: `${this.apiUrl}/api/v1/accounts/verify_credentials`,
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    };
    try {
      const account = await axios(request);
      return new Account(account.data);
    } catch (expect) {
      throw expect;
    }
  }

  async getAccountByID(id) {
    const request = {
      method: "GET",
      url: `${this.apiUrl}/api/v1/accounts/${id}`,
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    };
    try {
      const account = await axios(request);
      return new Account(account.data);
    } catch (expect) {
      throw expect;
    }
  }

  async followRemoteAccount(uri) {
    const request = {
      method: "POST",
      url: `${this.apiUrl}/api/v1/follows`,
      data: { uri },
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    };
    try {
      const account = await axios(request);
      return new Account(account.data);
    } catch (expect) {
      throw expect;
    }
  }

  async uploadMedia(stream, description = "") {
    const form = new formData();
    form.append("file", stream);
    form.append("description", description);
    const headers = form.getHeaders();
    headers["Authorization"] = `Bearer ${this.token}`;
    const request = {
      method: "POST",
      url: `${this.apiUrl}/api/v1/media`,
      headers,
      data: form,
    };
    try {
      const attachment = await axios(request);
      return new Attachment(attachment.data);
    } catch (expect) {
      throw expect;
    }
  }

  async getStatusByID(id) {
    const request = {
      method: "GET",
      url: `${this.apiUrl}/api/v1/statuses/${id}`,
    };

    try {
      const status = await axios(request);
      return new Status(status.data);
    } catch (expect) {
      throw expect;
    }
  }
}

module.exports = Client;
