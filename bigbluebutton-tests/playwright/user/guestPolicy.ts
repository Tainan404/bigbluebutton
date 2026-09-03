import { expect } from '@playwright/test';

import { ELEMENT_WAIT_LONGER_TIME } from '../core/constants';
import { elements as e } from '../core/elements';
import { MultiUsers } from './multiusers';
import { openLockViewers, setGuestPolicyOption } from './util';

export class GuestPolicy extends MultiUsers {
  async initTwoWaitingUsers() {
    await this.initUserPage(this.context, {
      fullName: 'AuthenticatedViewer',
      shouldCloseAudioModal: false,
      shouldCheckAllInitialSteps: false,
    });
    await this.initUserPage2(this.context, {
      fullName: 'GuestViewer',
      joinParameter: 'guest=true',
      shouldCloseAudioModal: false,
      shouldCheckAllInitialSteps: false,
    });
    await this.userPage.hasText(
      e.guestMessage,
      /wait/,
      'should display the waiting message for the authenticated viewer',
    );
    await this.userPage2.hasText(e.guestMessage, /wait/, 'should display the waiting message for the guest viewer');
    await this.modPage.waitAndClick(e.usersListSidebarButton);
  }

  async showUnifiedWaitingQueue() {
    await this.initTwoWaitingUsers();

    const waitingUsers = this.modPage.page.locator(e.waitingUsers);
    await expect(waitingUsers, 'should display one waiting users queue').toHaveCount(1);
    await expect(waitingUsers).toHaveText(/Waiting Users\s*2$/);
    const allowEveryone = this.modPage.page.locator(e.allowEveryone);
    const denyEveryone = this.modPage.page.locator(e.denyEveryone);
    await expect(allowEveryone).toHaveText('Allow everyone (2)');
    await expect(denyEveryone).toHaveText('Deny everyone (2)');
    await expect(allowEveryone).toHaveCSS('color', 'rgb(0, 128, 129)');
    await expect(denyEveryone).toHaveCSS('color', 'rgb(223, 39, 33)');

    const actionButtonsBox = await allowEveryone.locator('..').boundingBox();
    const actionRowBox = await allowEveryone.locator('../..').boundingBox();
    expect(actionButtonsBox).not.toBeNull();
    expect(actionRowBox).not.toBeNull();
    const rightInset = actionRowBox!.x + actionRowBox!.width - actionButtonsBox!.x - actionButtonsBox!.width;
    expect(Math.abs(rightInset)).toBeLessThanOrEqual(10);
  }

  async denyEveryoneInWaitingQueues() {
    await this.initTwoWaitingUsers();
    await this.modPage.waitAndClick(e.denyEveryone);

    await this.userPage.hasText(
      e.guestMessage,
      /denied/,
      'should deny the authenticated viewer',
      ELEMENT_WAIT_LONGER_TIME,
    );
    await this.userPage2.hasText(e.guestMessage, /denied/, 'should deny the guest viewer', ELEMENT_WAIT_LONGER_TIME);
    await expect(this.modPage.page.locator(e.waitingUsers)).toHaveCount(0);
  }

  async allowEveryoneInWaitingQueues() {
    await this.initTwoWaitingUsers();
    await this.modPage.waitAndClick(e.allowEveryone);

    await this.userPage.hasText(
      e.guestMessage,
      /approved/,
      'should allow the authenticated viewer',
      ELEMENT_WAIT_LONGER_TIME,
    );
    await this.userPage2.hasText(e.guestMessage, /approved/, 'should allow the guest viewer', ELEMENT_WAIT_LONGER_TIME);
    await expect(this.modPage.page.locator(e.waitingUsers)).toHaveCount(0);
  }

  async keepQueueTotalVisibleWhileSearching() {
    await this.initTwoWaitingUsers();
    await this.modPage.waitAndClick(e.waitingUsers);
    await expect(this.modPage.page.getByText(/^\[\d+\] GuestViewer$/)).toBeVisible();
    await this.modPage.fill(e.userListSearch, 'AuthenticatedViewer');

    await expect(this.modPage.page.getByText(/^\[\d+\] GuestViewer$/)).toHaveCount(0);
    await expect(this.modPage.page.getByText(/^\[\d+\] AuthenticatedViewer$/)).toBeVisible();
    await expect(this.modPage.page.locator(e.waitingUsers)).toHaveText(/Waiting Users\s*2$/);
    await this.modPage.waitAndClick(e.denyEveryone);
    await this.userPage.hasText(
      e.guestMessage,
      /denied/,
      'should deny the authenticated viewer excluded by the search',
      ELEMENT_WAIT_LONGER_TIME,
    );
    await this.userPage2.hasText(
      e.guestMessage,
      /denied/,
      'should deny the guest viewer excluded by the search',
      ELEMENT_WAIT_LONGER_TIME,
    );
  }

  async messageToGuestLobby() {
    await setGuestPolicyOption(this.modPage, e.askModerator);
    await this.modPage.page.waitForTimeout(500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await openLockViewers(this.modPage);
    await this.modPage.waitAndClick(e.guestPolicyTab);
    await this.modPage.page
      .getByText("Message to the guests' lobby", { exact: true })
      .locator('..')
      .getByRole('checkbox')
      .click();
    await this.modPage.fill(e.waitingUsersLobbyMessage, 'test');
    await this.modPage.waitAndClick(e.sendLobbyMessage);
    await this.userPage.hasText(
      e.guestMessage,
      /test/,
      'should the guest message contain the text "test"',
      ELEMENT_WAIT_LONGER_TIME,
    );
  }

  async allowEveryone() {
    await setGuestPolicyOption(this.modPage, e.askModerator);
    await this.modPage.page.waitForTimeout(500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await this.userPage.hasText(
      e.guestMessage,
      /wait/,
      'should the guest message contain the text "wait" for the attendee',
    );
    await this.userPage.hasText(
      e.positionInWaitingQueue,
      /first/,
      'should the position in waiting queue contain the text "first" for the attendee',
    );
    await expect(this.modPage.page.locator(e.allowEveryone)).toBeVisible();
    await this.modPage.waitAndClick(e.allowEveryone);

    await this.userPage.hasText(
      e.guestMessage,
      /approved/,
      'should the guest message contain the text "approved" for the attendee',
      ELEMENT_WAIT_LONGER_TIME,
    );
    await this.modPage.hasElement(
      e.viewerAvatar,
      'should display the viewer avatar for the moderator',
      ELEMENT_WAIT_LONGER_TIME,
    );
    await this.userPage.hasElement(
      e.audioModal,
      'should display the audio modal for the attendee',
      ELEMENT_WAIT_LONGER_TIME,
    );
  }

  async denyEveryone() {
    await setGuestPolicyOption(this.modPage, e.askModerator);
    await this.modPage.page.waitForTimeout(500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await expect(this.modPage.page.locator(e.denyEveryone)).toBeVisible();
    await this.modPage.waitAndClick(e.denyEveryone);

    await this.userPage.hasText(
      e.guestMessage,
      /denied/,
      'should the guest message contain the text "denied" for the attendee',
      ELEMENT_WAIT_LONGER_TIME,
    );
  }

  async rememberChoice() {
    await setGuestPolicyOption(this.modPage, e.askModerator);
    await this.modPage.page.waitForTimeout(500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await this.modPage.waitAndClick(e.rememberChoice);
    await this.modPage.hasElementEnabled(e.rememberChoice, 'should display the remember checkbox as enabled');
    await this.modPage.waitAndClick(e.denyEveryone);

    await this.initUserPage2(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await this.userPage2.hasElement(e.deniedMessageElement, 'should display the denied message for the attendee');
  }

  async messageToSpecificUser() {
    await setGuestPolicyOption(this.modPage, e.askModerator);
    await this.modPage.page.waitForTimeout(500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await this.modPage.waitAndClick(e.waitingUsers);

    await this.modPage.waitAndClick(e.privateMessageGuest);
    await this.modPage.fill(e.inputPrivateLobbyMessage, 'test');
    await this.modPage.waitAndClick(e.sendPrivateLobbyMessage);
    await this.userPage.hasText(
      e.guestMessage,
      /test/,
      'should the guest message contain the text "test" for the attendee',
      ELEMENT_WAIT_LONGER_TIME,
    );
  }

  async acceptSpecificUser() {
    await setGuestPolicyOption(this.modPage, e.askModerator);
    await this.modPage.page.waitForTimeout(500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await this.userPage.hasText(
      e.guestMessage,
      /wait/,
      'should the guest message contain the text "wait" for the attendee',
    );
    await this.userPage.hasText(
      e.positionInWaitingQueue,
      /first/,
      'should the position in waiting queue contain the text "first"',
    );
    await this.modPage.waitAndClick(e.waitingUsers);
    await this.modPage.waitAndClick(e.acceptGuest);
    await this.userPage.hasText(
      e.guestMessage,
      /approved/,
      'should the guest message contain the text "approved" for the attendee',
      ELEMENT_WAIT_LONGER_TIME,
    );

    await this.modPage.waitForSelector(e.viewerAvatar, ELEMENT_WAIT_LONGER_TIME);
    await this.userPage.hasElement(e.audioModal, 'should display the audio modal for the attendee');
  }

  async denySpecificUser() {
    await setGuestPolicyOption(this.modPage, e.askModerator);
    await this.modPage.page.waitForTimeout(500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await this.modPage.waitAndClick(e.waitingUsers);

    await this.modPage.waitAndClick(e.denyGuest);
    await this.userPage.hasText(
      e.guestMessage,
      /denied/,
      'should the guest message contain the text "denied" for the attendee',
      ELEMENT_WAIT_LONGER_TIME,
    );
  }

  async alwaysAccept() {
    await setGuestPolicyOption(this.modPage, e.askModerator);
    await setGuestPolicyOption(this.modPage, e.alwaysAccept);
    await this.modPage.page.waitForTimeout(500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await this.userPage.hasElement(e.audioModal, 'should display the audio modal for the attendee');
  }

  async alwaysDeny() {
    await setGuestPolicyOption(this.modPage, e.alwaysDeny);
    await this.modPage.page.waitForTimeout(1500);
    await this.initUserPage(this.context, { shouldCloseAudioModal: false, shouldCheckAllInitialSteps: false });
    await this.userPage.hasElement(e.deniedMessageElement, 'should display the denied message for the attendee');
  }
}
