import { expect } from '@playwright/test';

import { ELEMENT_WAIT_LONGER_TIME } from '../core/constants';
import { elements as e } from '../core/elements';
import { checkTextContent } from '../core/util';
import { MultiUsers } from '../user/multiusers';
import { checkLastMessageSent, openPrivateChat, openPublicChat } from './util';

export class Chat extends MultiUsers {
  async sendPublicMessage() {
    await openPublicChat(this.modPage);
    await this.modPage.hasElementCount(e.chatUserMessageText, 0, 'should have none message on the public chat');

    await this.modPage.fill(e.chatBox, e.message);
    await this.userPage.hasElement(e.typingIndicator, 'should display the typing indicator element');
    await this.modPage.page.click(e.sendButton);
    await this.modPage.hasElementCount(e.chatUserMessageText, 1, 'should have on message on the public chat');
  }

  async sendPrivateMessage() {
    await this.modPage.hasElement(e.chatBox, 'should display the chat box element when chat is open');
    await this.modPage.wasRemoved(e.publicChatButton, 'should not display the public chat button when there is no private messages');
    await this.modPage.wasRemoved(e.privateChatButton, 'should not display the private chat button when there is no private messages');
    await openPrivateChat(this.modPage);
    await this.modPage.hasElement(
      e.hidePrivateChat,
      'should display the hide private chat element when opening a private chat',
    );
    // prevent a race condition when running on a deployed server
    await this.modPage.page.waitForTimeout(500);
    // modPage send message
    await this.modPage.fill(e.chatBox, e.message1);
    await this.modPage.waitAndClick(e.sendButton);
    await this.userPage.waitAndClick(e.privateChatButton);
    await this.userPage.hasElement(e.privateChatItem, 'should display the private chat item when user receives a private message');
    await this.userPage.waitAndClick(e.privateChatItem);
    await this.userPage.hasElement(
      e.hidePrivateChat,
      'should display the hide private chat element when opening a private chat',
    );
    // check sent messages
    await this.modPage.hasText(e.chatUserMessageText, e.message1, 'should display the message sent by the moderator');
    await this.userPage.hasText(
      e.chatUserMessageText,
      e.message1,
      'should display the message sent by the moderator for the attendee',
    );
    // userPage send message
    await this.userPage.fill(e.chatBox, e.message2);
    await this.modPage.hasElement(
      e.typingIndicator,
      'should display the typing indicator for the moderator when user is typing a message',
    );
    await this.userPage.waitAndClick(e.sendButton);
    // check sent messages
    await this.modPage.hasText(
      `${e.chatUserMessageText}>>nth=1`,
      e.message2,
      'should display the message "Hello User1" for the moderator',
    );
    await this.userPage.hasText(
      `${e.chatUserMessageText}>>nth=1`,
      e.message2,
      'should display the message "Hello User1" for the moderator',
    );
    await this.modPage.waitAndClick(e.publicChatButton);
    await this.userPage.waitAndClick(e.publicChatButton);
  }

  // Opens the private chat with a specific user by name (the shared openPrivateChat helper only
  // targets the last user in the list, which is not enough when seeding several chats).
  async startPrivateChatWithUser(name: string) {
    await this.modPage.waitAndClick(e.usersListSidebarButton);
    const userItem = this.modPage.page.locator(e.userListItem, { hasText: name }).first();
    await userItem.waitFor({ state: 'visible', timeout: ELEMENT_WAIT_LONGER_TIME });
    await userItem.hover();
    await userItem.locator(e.startPrivateChat).first().click();
    await this.modPage.hasElement(e.hidePrivateChat, `should open the private chat with ${name}`);
  }

  // Regression guard for issue 25416: opening the private chat list used to render each item
  // short (avatar + name only) and then grow it once the per-item last-message subscription
  // resolved, making the list reflow. The item now reserves one text line for the preview
  // (skeleton placeholder + a min-height backstop) so its height never changes while loading.
  async privateChatPreviewNoReflow() {
    // Seed two chats with legitimately different final heights: one with a last message (tall,
    // reserves a preview line) and one left empty (short, no preview). The per-item assertion
    // below must not conflate them - the whole point of the fix is that empty and non-empty
    // rows differ.
    await this.startPrivateChatWithUser(this.userPage.username);
    // prevent a race condition when running on a deployed server
    await this.modPage.page.waitForTimeout(500);
    await this.modPage.fill(e.chatBox, e.message1);
    await this.modPage.waitAndClick(e.sendButton);
    await checkLastMessageSent(this.modPage, e.message1);
    await this.startPrivateChatWithUser(this.userPage2.username); // empty chat, no message sent

    // Let the chats-list subscription settle each chat's totalMessages before measuring. This is
    // a different async source than the preview-lag bug under test: a just-created chat can mount
    // with totalMessages still 0 (no preview reserved) and then resize to its real height once
    // the count propagates, which would false-fail the stability check. Needed even with the
    // ResizeObserver, which faithfully reports that unrelated resize.
    await this.modPage.page.waitForTimeout(2000);

    // Open the list and watch every item with a ResizeObserver installed BEFORE the click, so no
    // sampling gap can hide a transient: the buggy build grows the non-empty item from its short
    // to its tall height as the preview resolves, and the observer records both. A MutationObserver
    // attaches the ResizeObserver to each item the moment it mounts. Heights are keyed by chat name
    // (aria-label), not by node, so a React remount that split the short and tall heights across two
    // nodes still lands both under the same key and fails the stability check.
    await this.modPage.hasElement(e.privateChatButton, 'should display the private chat button');
    const items: { name: string; heights: number[] }[] = await this.modPage.page.evaluate(
      async ({ itemSel, buttonSel, durationMs }) => {
        const heightsByName = new Map<string, Set<number>>();
        const record = (el: Element) => {
          const name = el.getAttribute('aria-label') ?? 'unknown';
          const set = heightsByName.get(name) ?? new Set<number>();
          set.add(Math.round(el.getBoundingClientRect().height));
          heightsByName.set(name, set);
        };
        const observed = new WeakSet<Element>();
        const resizeObserver = new ResizeObserver((entries) => entries.forEach((entry) => record(entry.target)));
        const observe = (el: Element) => {
          if (!observed.has(el)) {
            observed.add(el);
            record(el);
            resizeObserver.observe(el);
          }
        };
        const mutationObserver = new MutationObserver(() => document.querySelectorAll(itemSel).forEach(observe));
        mutationObserver.observe(document.body, { childList: true, subtree: true });
        (document.querySelector(buttonSel) as HTMLElement).click();
        document.querySelectorAll(itemSel).forEach(observe);
        await new Promise((resolve) => {
          setTimeout(resolve, durationMs);
        });
        mutationObserver.disconnect();
        resizeObserver.disconnect();
        return Array.from(heightsByName.entries()).map(([name, set]) => ({ name, heights: Array.from(set) }));
      },
      { itemSel: e.privateChatItem, buttonSel: e.privateChatButton, durationMs: 2500 },
    );

    // both seeded chats must be present, and each individual item must have kept a single stable
    // height (on the buggy build the non-empty item is observed at two heights, e.g. 48 then 94)
    expect(items.length, 'should observe exactly the two seeded private chats').toBe(2);
    items.forEach(({ name, heights }) => {
      expect(
        heights,
        `the "${name}" private chat item height must be stable while the preview loads (observed: ${heights.join(', ')})`,
      ).toHaveLength(1);
    });

    // The fix's actual behavior: the chat with a message reserves a preview line and is taller than
    // the empty chat. This guards against a regression where willHavePreview is always false (no
    // preview ever renders) - that would keep every item stable but at the short height, passing the
    // checks above; here both rows would be equally short and this comparison would fail.
    const stableHeights = items.map((item) => item.heights[0]).sort((a, b) => a - b);
    expect(
      stableHeights[stableHeights.length - 1],
      'the chat with a message should be taller than the empty chat (preview line reserved)',
    ).toBeGreaterThan(stableHeights[0]);
  }

  async clearChat() {
    await openPublicChat(this.modPage);

    const userMessageTextCount = await this.modPage.getSelectorCount(e.chatUserMessageText);

    await this.modPage.fill(e.chatBox, e.message);
    await this.modPage.waitAndClick(e.sendButton);
    await this.modPage.hasElement(e.chatUserMessageText, 'should display a message sent by the moderator');

    // 1 message
    await this.modPage.hasElementCount(e.chatUserMessageText, userMessageTextCount + 1, 'should display one message');

    // clear
    await this.modPage.waitAndClick(e.chatOptions);
    await this.modPage.waitAndClick(e.chatClear);
    await this.modPage.hasText(
      e.chatNotificationMessageText,
      'The public chat history has been cleared by a moderator',
      'should display the message where the chat has been cleared',
    );
  }

  async copyChat() {
    const { publicChatOptionsEnabled } = this.modPage.settings || {};
    await openPublicChat(this.modPage);

    if (!publicChatOptionsEnabled) {
      await this.modPage.waitAndClick(e.chatOptions);
      await this.modPage.hasElement(e.chatClear, 'should display the option to clear the chat');
      await this.modPage.wasRemoved(e.chatCopy, 'should not display the option to copy the chat');
      return;
    }
    // sending a message
    await this.modPage.fill(e.chatBox, e.message);
    await this.modPage.waitAndClick(e.sendButton);

    await this.modPage.waitAndClick(e.chatOptions);

    await this.modPage.hasElement(e.chatUserMessageText, 'should display the message sent by the moderator');
    await this.modPage.grantClipboardPermissions();
    await this.modPage.waitAndClick(e.chatCopy);
    const copiedText = await this.modPage.getCopiedText();
    await expect(
      copiedText,
      'should display on the copied chat the same message that was sent on the public chat',
    ).toContain(`[${this.modPage.username} : MODERATOR]: ${e.message}`);
  }

  async saveChat() {
    const { publicChatOptionsEnabled } = this.modPage.settings || {};
    await openPublicChat(this.modPage);
    if (!publicChatOptionsEnabled) {
      await this.modPage.waitAndClick(e.chatOptions);
      await this.modPage.wasRemoved(e.chatSave, 'chat save option should not be displayed');
      return;
    }

    await this.modPage.fill(e.chatBox, e.message);
    await this.modPage.waitAndClick(e.sendButton);
    await this.modPage.hasElement(
      e.chatUserMessageText,
      'should display the message sent by the moderator on the public chat',
    );
    await this.modPage.waitAndClick(e.chatOptions);

    const chatSaveLocator = this.modPage.page.locator(e.chatSave);
    const { content } = await this.modPage.handleDownload(chatSaveLocator);
    const dataToCheck = [this.modPage.username, e.message];
    await checkTextContent(
      content,
      dataToCheck,
      'should display the same message on the saved chat message and the message sent on the public chat',
    );
  }

  async characterLimit() {
    const { maxMessageLength } = this.modPage.settings || {};

    await openPublicChat(this.modPage);

    const initialMessagesCount = await this.modPage.getSelectorCount(e.chatUserMessageText);
    // TODO test depends on the maxMessageLength; in case not available, loop until not able to type anymore
    await this.modPage.page.fill(e.chatBox, e.uniqueCharacterMessage.repeat(maxMessageLength || 1000));
    await this.modPage.waitAndClick(e.sendButton);
    await this.modPage.hasElement(
      e.chatUserMessageText,
      'should display only one message text sent by the user on the public chat',
    );
    await this.modPage.hasElementCount(
      e.chatUserMessageText,
      initialMessagesCount + 1,
      'should display 2 messages on the public chat',
    );

    await this.modPage.page.fill(e.chatBox, e.uniqueCharacterMessage.repeat(maxMessageLength || 1000));
    await this.modPage.type(e.chatBox, '123'); // it should has no effect
    await this.modPage.hasElement(e.errorTypingIndicator, 'Should appear the warning message below the chat box');
    await this.modPage.waitAndClick(e.sendButton);
    await this.modPage.hasElementCount(
      e.chatUserMessageText,
      initialMessagesCount + 2,
      'should display 2 additional messages on the public chat',
    );
  }

  async emptyMessage() {
    await openPublicChat(this.modPage);

    const userMessageTextCount = await this.modPage.getSelectorCount(e.chatUserMessageText);

    await this.modPage.waitAndClick(e.sendButton);
    await this.modPage.hasElementCount(
      e.chatUserMessageText,
      userMessageTextCount,
      'should have none messages on the chat',
    );
  }

  async copyPastePublicMessage() {
    await this.modPage.fill(e.chatBox, 'test');
    await this.modPage.waitAndClick(e.sendButton);
    await checkLastMessageSent(this.modPage, /test/);

    const messageElementBoundingBox = await this.modPage.page.locator(e.chatUserMessageText).last().boundingBox();
    if (!messageElementBoundingBox) throw Error('Failed to get message text element bounding box');

    await this.modPage.mouseDoubleClick(messageElementBoundingBox.x, messageElementBoundingBox.y);
    await this.modPage.press('Control+KeyC');
    await this.modPage.page.locator(e.chatBox).focus();
    await this.modPage.press('Control+KeyV');
    await this.modPage.type(e.chatBox, '2');
    await this.modPage.waitAndClick(e.sendButton);

    await checkLastMessageSent(this.modPage, /test2/);
  }

  async sendEmoji() {
    const { emojiPickerEnabled } = this.modPage.settings || {};

    await openPublicChat(this.modPage);

    if (!emojiPickerEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should display the chat box element');
      await this.modPage.wasRemoved(e.emojiPickerButton, 'should not display the emoji picker button element');
      return;
    }

    const message = this.modPage.page.locator(e.chatUserMessageText);
    await expect(message, 'should not display any messages on the public chat').toHaveCount(0);

    await this.modPage.waitAndClick(e.emojiPickerButton);
    await this.modPage.getByLabelAndClick(e.thumbsUpEmoji);
    await this.modPage.waitAndClick(e.sendButton);

    await this.modPage.waitForSelector(e.chatUserMessageText);
    await expect(message, 'should display only one message that contains an emoji on the public chat').toHaveCount(1);
  }

  async emojiCopyChat() {
    const { emojiPickerEnabled } = this.modPage.settings || {};

    await openPublicChat(this.modPage);

    if (!emojiPickerEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should display the chat box element on the public chat');
      await this.modPage.wasRemoved(
        e.emojiPickerButton,
        'should not display the emoji picker button on the public chat',
      );
      return;
    }
    await this.modPage.waitAndClick(e.emojiPickerButton);
    await this.modPage.getByLabelAndClick(e.thumbsUpEmoji);
    await this.modPage.waitAndClick(e.sendButton);
    await this.modPage.waitAndClick(e.chatOptions);
    await this.modPage.hasElement(
      e.chatUserMessageText,
      'should have one message that contains an emoji on the public chat',
    );
    await this.modPage.grantClipboardPermissions();
    await this.modPage.waitAndClick(e.chatCopy);
    const copiedText = await this.modPage.getCopiedText();
    await expect(copiedText, 'should the copied text be the same as the message on the chat').toContain(
      `[${this.modPage.username} : MODERATOR]: ${e.thumbsUpEmoji}`,
    );
  }

  async hidePublicMessages() {
    await openPublicChat(this.modPage);
    await this.modPage.hasElement(e.chatTitle, 'should display the chat title element');
    await this.modPage.hasElement(e.chatOptions, 'should display the chat options element');
    await this.modPage.hasElement(e.chatBox, 'should display the chat box element');
    await this.modPage.hasElement(e.sendButton, 'should display the send button element');
    await this.modPage.waitAndClick(e.hidePublicChat);
    await this.modPage.wasRemoved(e.chatTitle, 'should not display the chat title element after hiding the messages');
    await this.modPage.wasRemoved(e.chatOptions, 'should not display the chat options element after hiding the messages');
    await this.modPage.wasRemoved(e.chatBox, 'should not display the chat box element after hiding the messages');
    await this.modPage.wasRemoved(e.sendButton, 'should not display the send button element after hiding the messages');
  }

  async closePrivateChat() {
    await openPrivateChat(this.modPage);
    await this.modPage.waitUntilHaveCountSelector(e.chatButton, 2);
    const privateChatLocator = this.modPage.getLocatorByIndex(e.chatButton, -1);
    await expect(privateChatLocator, 'should the private chat contain the user name').toContainText(
      this.userPage.username,
    );

    const chatMessageCount = await this.modPage.getSelectorCount(e.chatUserMessageText);

    await this.modPage.hasElement(
      e.hidePrivateChat,
      'the private chat should display the hide private chat element when opened',
    );
    await this.modPage.hasElement(
      e.privateChatBackButton,
      'the private chat should display the back button element when opened',
    );
    await this.modPage.hasElementCount(
      e.chatUserMessageText,
      chatMessageCount,
      'should not display any new messages on the private chat',
    );
    await this.modPage.fill(e.chatBox, e.message1);
    await this.modPage.waitAndClick(e.sendButton);
    await this.userPage.waitUntilHaveCountSelector(e.chatButton, 2);
    await this.modPage.waitAndClick(e.privateChatBackButton);
    await this.modPage.wasRemoved(e.privateChatBackButton, 'should not display the back button element');
    await this.userPage.hasElementCount(e.chatButton, 2, 'should display both chat buttons for the viewer');
  }

  async emojiSaveChat() {
    const { emojiPickerEnabled } = this.modPage.settings || {};

    await openPublicChat(this.modPage);
    if (!emojiPickerEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should display the public chat box');
      await this.modPage.wasRemoved(e.emojiPickerButton, 'should not display the emoji picker button');
      return;
    }
    await this.modPage.waitAndClick(e.emojiPickerButton);
    await this.modPage.getByLabelAndClick(e.thumbsUpEmoji);
    await this.modPage.waitAndClick(e.sendButton);
    await this.modPage.hasElement(e.chatUserMessageText, 'should display a message on the public chat with an emoji');
    await this.modPage.waitAndClick(e.chatOptions);
    const chatSaveLocator = this.modPage.page.locator(e.chatSave);
    const { content } = await this.modPage.handleDownload(chatSaveLocator);

    const dataToCheck = [this.modPage.username, e.thumbsUpEmoji];
    await checkTextContent(
      content,
      dataToCheck,
      'should the save chat message with an emoji be the same as message sent on the public chat',
    );
  }

  async emojiSendPrivateChat() {
    const { emojiPickerEnabled } = this.modPage.settings || {};

    await openPrivateChat(this.modPage);
    await this.modPage.hasElement(
      e.hidePrivateChat,
      'should display the hide private chat element when a private chat is open',
    );
    // prevent a race condition when running on a deployed server
    await this.modPage.page.waitForTimeout(500);
    // modPage send message
    if (!emojiPickerEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should display the public chat box');
      await this.modPage.wasRemoved(
        e.emojiPickerButton,
        'should not display the emoji picker button on the public chat',
      );
      return;
    }
    await this.modPage.waitAndClick(e.emojiPickerButton);
    await this.modPage.getByLabelAndClick(e.thumbsUpEmoji);
    await this.modPage.waitAndClick(e.sendButton);
    await this.userPage.waitAndClick(e.privateChatButton);
    await this.userPage.waitAndClick(e.privateChatItem);
    await this.userPage.hasElement(
      e.hidePrivateChat,
      'should display the hide private chat element when the attendee opens the private chat',
    );
    // check sent messages
    await this.modPage.hasText(
      e.chatUserMessageText,
      e.thumbsUpEmoji,
      'should display the emoji sent by the moderator on the private chat',
    );
    await this.userPage.hasText(
      e.chatUserMessageText,
      e.thumbsUpEmoji,
      'should display for the user the emoji sent by the moderator on the private chat',
    );
    // userPage send message
    await this.userPage.waitAndClick(e.emojiPickerButton);
    await this.userPage.getByLabelAndClick(e.thumbsUpEmoji);
    await this.userPage.waitAndClick(e.sendButton);
    // check sent messages
    await this.modPage.hasText(
      e.privateChat,
      e.thumbsUpEmoji,
      'should display the emoji sent by the attendee on the private chat',
    );
    await this.userPage.hasText(
      e.privateChat,
      e.thumbsUpEmoji,
      'should display the emoji on the private chat for the user',
    );
  }

  async autoConvertEmojiPublicChat() {
    const { autoConvertEmojiEnabled } = this.modPage.settings || {};

    try {
      await this.modPage.hasElement(
        e.hidePrivateChat,
        'should display the hide private chat element for the moderator when private chat is open',
      );
      await this.modPage.waitAndClick(e.messagesSidebarButton);
    } catch {
      await this.modPage.hasElement(
        e.hidePublicChat,
        'should display the hide public chat element for the moderator when public chat is open',
      );
    }

    await this.modPage.waitAndClick(e.chatOptions);
    await this.modPage.waitAndClick(e.chatClear);

    await this.modPage.hasElementCount(e.chatUserMessageText, 0, 'should not display any messages on the public chat');

    await this.modPage.fill(e.chatBox, e.autoConvertEmojiMessage);
    await this.modPage.waitAndClick(e.sendButton);

    if (!autoConvertEmojiEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should display a chat box on the public chat');
      await this.modPage.hasText(`${e.chatUserMessageText}>>nth=1`, ':)', 'should not display the emoji converted');
      return;
    }
    await this.modPage.hasElement(e.chatUserMessageText, 'should display the user messages sent on the chat');
    await this.modPage.hasElementCount(e.chatUserMessageText, 1, 'should display only one message on the public chat');
  }

  async autoConvertEmojiEscapePublicChat() {
    const { autoConvertEmojiEnabled } = this.modPage.settings || {};

    try {
      await this.modPage.hasElement(
        e.hidePrivateChat,
        'should display the hide private chat element for the moderator when private chat is open',
      );
      await this.modPage.waitAndClick(e.chatButton);
    } catch {
      await this.modPage.hasElement(
        e.hidePublicChat,
        'should display the hide public chat element for the moderator when public chat is open',
      );
    }

    await this.modPage.waitAndClick(e.chatOptions);
    await this.modPage.waitAndClick(e.chatClear);
    await this.modPage.hasElementCount(e.chatUserMessageText, 0, 'should not display any messages on the public chat');

    // a backslash before an emoticon escapes the auto conversion (issue #23344)
    await this.modPage.fill(e.chatBox, e.escapedEmojiMessage);
    await this.modPage.waitAndClick(e.sendButton);

    if (!autoConvertEmojiEnabled) {
      // with auto conversion disabled nothing is converted and the backslash is kept as typed
      await checkLastMessageSent(this.modPage, e.escapedEmojiMessage);
      return;
    }

    // the emoticon is not converted to an emoji and the escaping backslash is consumed
    await checkLastMessageSent(this.modPage, e.autoConvertEmojiMessage);
  }

  async autoConvertEmojiCopyChat() {
    const { autoConvertEmojiEnabled } = this.modPage.settings || {};

    await openPublicChat(this.modPage);
    await this.modPage.fill(e.chatBox, e.autoConvertEmojiMessage);
    await this.modPage.waitAndClick(e.sendButton);
    if (!autoConvertEmojiEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should display chat box on the public chat for the moderator');
      await this.modPage.hasText(
        `${e.chatUserMessageText}>>nth=1`,
        ':)',
        'should display a message on the public chat with an emoji no converted',
      );
      return;
    }
    await this.modPage.waitAndClick(e.chatOptions);
    await this.modPage.hasElement(e.chatUserMessageText, 'should display a message sent by user on the public chat');
    await this.modPage.grantClipboardPermissions();
    await this.modPage.waitAndClick(e.chatCopy);

    const copiedText = await this.modPage.getCopiedText();
    await expect(copiedText, 'should the copied text be the same as the message on the chat').toContain(
      `[${this.modPage.username} : MODERATOR]: ${e.convertedEmojiMessage}`,
    );
  }

  async autoConvertEmojiSaveChat() {
    const { autoConvertEmojiEnabled } = this.modPage.settings || {};

    await openPublicChat(this.modPage);
    await this.modPage.fill(e.chatBox, e.autoConvertEmojiMessage);
    await this.modPage.waitAndClick(e.sendButton);
    if (!autoConvertEmojiEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should display the chat box on the public chat');
      await this.modPage.hasText(
        `${e.chatUserMessageText}>>nth=1`,
        ':)',
        'should display a message containing the emoji not converted',
      );
      return;
    }
    await this.modPage.hasElement(e.chatUserMessageText, 'should display a message on the public chat');
    await this.modPage.waitAndClick(e.chatOptions);
    const chatSaveLocator = this.modPage.page.locator(e.chatSave);
    const { content } = await this.modPage.handleDownload(chatSaveLocator);

    const dataToCheck = [this.modPage.username, e.convertedEmojiMessage];
    await checkTextContent(
      content,
      dataToCheck,
      'should the saved emoji from the chat be the same as the emoji sent on the chat',
    );
  }

  async autoConvertEmojiSendPrivateChat() {
    const { autoConvertEmojiEnabled, emojiPickerEnabled } = this.modPage.settings || {};

    await openPrivateChat(this.modPage);
    await this.modPage.hasElement(
      e.hidePrivateChat,
      'should display the hide private chat element when the moderator has the private chat opened',
    );
    // prevent a race condition when running on a deployed server
    await this.modPage.page.waitForTimeout(500);
    // modPage send message
    await this.modPage.fill(e.chatBox, e.autoConvertEmojiMessage);
    await this.modPage.waitAndClick(e.sendButton);
    if (!autoConvertEmojiEnabled && !emojiPickerEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should display the chat box on the private chat');
      await this.modPage.hasText(
        `${e.chatUserMessageText}>>nth=0`,
        ':)',
        'should display the message that the emoji is not converted',
      );
      return;
    }
    if (!autoConvertEmojiEnabled) {
      await this.modPage.hasElement(e.chatBox, 'should the chat box be displayed on the private chat');
      await this.modPage.hasText(
        `${e.chatUserMessageText}>>nth=2`,
        ':)',
        'should display the emoji not converted on the private chat',
      );
      return;
    }
    await this.userPage.waitAndClick(e.privateChatButton);
    await this.userPage.hasElement(e.privateChatItem, 'should display the private chat item when the user receives a private message');
    await this.userPage.waitAndClick(e.privateChatItem);
    // check sent messages
    await checkLastMessageSent(this.modPage, e.convertedEmojiMessage);
    await checkLastMessageSent(this.userPage, e.convertedEmojiMessage);
    // userPage send message
    await this.userPage.fill(e.chatBox, e.autoConvertEmojiMessage);
    await this.userPage.waitAndClick(e.sendButton);
    // check sent messages
    const lastMessageLocator = this.modPage.page.locator(e.chatUserMessageText).last();
    await expect(
      lastMessageLocator,
      'should the last message sent on private chat to be the auto converted emoji',
    ).toHaveText(e.convertedEmojiMessage);
    const lastMessageLocatorUser = this.userPage.page.locator(e.chatUserMessageText).last();
    await expect(
      lastMessageLocatorUser,
      'should the last message sent on private chat to be the auto converted emoji',
    ).toHaveText(e.convertedEmojiMessage);
  }

  async chatDisabledUserLeaves() {
    await openPrivateChat(this.modPage);
    await this.modPage.hasElement(e.sendButton, 'should display the send button on the private chat');
    await this.userPage.logoutFromMeeting();
    await this.modPage.hasElement(
      e.partnerDisconnectedMessage,
      'should the attendee be disconnected',
      ELEMENT_WAIT_LONGER_TIME,
    );
    await this.modPage.wasRemoved(
      e.sendButton,
      'should the send button be removed because the attendee left the meeting',
    );
  }
}
