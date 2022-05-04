#!/usr/bin/env node

"use strict";
require("dotenv").config();

const { Client } = require("pg");
const donjs = require("./DonJS");

let me = null;
const accountRegex = /(([a-z\d]+_)*[a-z\d]+)\.near[^a-z\d_.\-]/;

const pgClient = new Client({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_SERVICE_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_SERVICE_PORT,
});

const InvitationResult = {
  AlreadyInvited: "AlreadyInvited",
  Invited: "Invited",
  Failed: "Failed",
};

const inviteAccount = async (accountId) => {
  const inviteCheck = await pgClient.query(
    `SELECT id FROM invites
        WHERE
            code = $1::varchar
            AND (account_id = $2::varchar OR account_id IS NULL)
            AND attempts > 0
        LIMIT 1;`,
    [accountId, accountId]
  );
  if (inviteCheck.rows.length > 0) {
    // Already invited.
    return InvitationResult.AlreadyInvited;
  }
  const res = await pgClient.query(
    `INSERT INTO invites
        (code, attempts, account_id, creator)
     VALUES
        ($1::varchar, 1, $1::varchar, 'invitebot')`,
    [accountId]
  );
  return res.rowCount > 0 ? InvitationResult.Invited : InvitationResult.Failed;
};

const parseStatus = async (status) => {
  const mentionPattern = `>@<span>${me.username}</span></a></span> `;
  const content = status.content;
  const mentionPos = content.indexOf(mentionPattern);
  if (status.account.acct !== status.account.username) {
    return await status.reply(
      `@${status.account.acct} Sorry, only NEAR accounts can invite others.`
    );
  }
  const replyTo = `@${status.account.username}`;
  if (mentionPos >= 0) {
    const remaining = content.slice(mentionPos + mentionPattern.length);
    const accountMatch = remaining.match(accountRegex);
    if (accountMatch) {
      // Account ID without .near
      const accountId = accountMatch[1];
      if (accountId.length <= 30) {
        const nearAccountId = `${accountId}.near`;
        const invitationResult = await inviteAccount(nearAccountId);
        if (invitationResult === InvitationResult.AlreadyInvited) {
          await status.reply(
            `${replyTo} No worries! ${nearAccountId} is already invited`
          );
        } else if (invitationResult === InvitationResult.Invited) {
          await status.reply(`${replyTo} You got it! Invited ${nearAccountId}`);
        } else {
          await status.reply(
            `${replyTo} Sorry! For some reason failed to invite ${nearAccountId}`
          );
        }
      } else {
        await status.reply(
          `${replyTo} Sorry! The account ID ${accountId}.near is too long, it can be at most 35 characters long.`
        );
      }
    } else {
      await status.reply(
        `${replyTo} Bummer! I don't understand, please provide valid account ID.\nNote, there are some limitations: an account ID has to end with ".near" and can't include sub-accounts or hyphens.`
      );
    }
  } else {
    await status.reply(
      `${replyTo} Ser, please only mention me to invite someone to the best social platform.`
    );
  }
};

const main = async (client) => {
  await pgClient.connect();
  me = await client.getClientAccount();

  // await parseStatus({
  //   content:
  //     '<p><span class="h-card"><a href="https://near.social/@invitebot" class="u-url mention">@<span>invitebot</span></a></span> alex.near</p>',
  // });

  client.listenForNotifications();
  client.on("onNotification", async (notification) => {
    console.log(
      "there is a new notification!",
      JSON.stringify(notification, null, 2)
    );
    if (notification.status) {
      await parseStatus(notification.status);
    }
  });
};

const client = new donjs(
  process.env.ACCESS_TOKEN,
  process.env.MASTODON_INSTANCE
);

main(client).then(() => {
  // process.exit(0);
});
