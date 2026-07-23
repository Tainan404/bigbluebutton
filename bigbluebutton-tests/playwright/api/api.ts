import { expect, Page as PlaywrightPage, TestInfo } from '@playwright/test';
import axios from 'axios';
import * as xml2js from 'xml2js';

import { getMeetingInfo, getMeetings, GetMeetingsResponse } from '../core/endpoints';
import { apiCall, createMeeting, getApiCallUrl, getRandomInt } from '../core/helpers';
import { MultiUsers } from '../user/multiusers';

// Minimal shape of the parsed (xml2js) `create` response we assert on.
interface CreateResponse {
  response: {
    returncode: string[];
    voiceBridge?: string[];
    errors?: Array<{ error: Array<{ key: string[] }> }>;
  };
}

export class API extends MultiUsers {
  async getNewPageTab() {
    return this.browser.newPage();
  }

  // The obsolete `webVoice` create parameter was removed (dead since the Flash
  // client). Passing it must still be accepted and silently ignored (unknown
  // params are not rejected), and the meeting's voice conference must come from
  // voiceBridge/telVoice alone - never from a distinct webVoice value.
  static async testCreateIgnoresDistinctWebVoice() {
    const voiceBridge = getRandomInt(10000, 99999).toString();
    // A webVoice value deliberately different from voiceBridge; it must have no effect.
    const webVoice = getRandomInt(10000, 99999).toString();
    const meetingID = `webvoice-ignored-${getRandomInt(1000000, 10000000).toString()}`;

    const { data, status } = await apiCall<CreateResponse>('create', {
      name: meetingID,
      meetingID,
      moderatorPW: 'mp',
      attendeePW: 'ap',
      voiceBridge,
      webVoice,
    });
    expect(status, 'create should return HTTP 200').toEqual(200);
    expect(data.response.returncode[0], 'create with a distinct webVoice should still succeed').toEqual('SUCCESS');
    expect(data.response.voiceBridge?.[0], 'the voice conference must equal voiceBridge, not webVoice').toEqual(
      voiceBridge,
    );

    // getMeetingInfo must report the same voiceBridge (webVoice has no surface).
    const { data: info } = await getMeetingInfo(meetingID);
    expect(info.response.returncode[0]).toEqual('SUCCESS');
    expect(info.response.voiceBridge?.[0], 'getMeetingInfo voiceBridge must match voiceBridge').toEqual(voiceBridge);

    await apiCall('end', { meetingID, password: 'mp' });
  }

  // Removing the redundant webVoice collision check must not weaken voiceBridge
  // uniqueness: a second running meeting reusing a voiceBridge still fails.
  static async testVoiceBridgeCollisionStillDetected() {
    const voiceBridge = getRandomInt(10000, 99999).toString();
    const suffix = getRandomInt(1000000, 10000000).toString();
    const meetingIdA = `webvoice-collision-a-${suffix}`;
    const meetingIdB = `webvoice-collision-b-${suffix}`;

    const { data: dataA } = await apiCall<CreateResponse>('create', {
      name: meetingIdA,
      meetingID: meetingIdA,
      moderatorPW: 'mp',
      voiceBridge,
    });
    expect(dataA.response.returncode[0], 'first create should succeed').toEqual('SUCCESS');

    // Reusing the voiceBridge (different meetingID) must be rejected. We request
    // XML explicitly: the API's JSON error renderer is a separate, pre-existing
    // path that returns HTTP 500 for any create error (the breakout API tests
    // rely on that 500), which would mask the collision result we assert here.
    const collisionUrl = getApiCallUrl('create', {
      name: meetingIdB,
      meetingID: meetingIdB,
      moderatorPW: 'mp',
      voiceBridge,
    });
    const collisionResponse = await axios.get(collisionUrl, {
      adapter: 'http',
      headers: { Accept: 'application/xml' },
    });
    const dataB = (await xml2js.parseStringPromise(collisionResponse.data)) as CreateResponse;
    expect(dataB.response.returncode[0], 'reusing a voiceBridge should fail').toEqual('FAILED');
    expect(dataB.response.errors?.[0].error[0].key[0], 'should fail with nonUniqueVoiceBridge').toEqual(
      'nonUniqueVoiceBridge',
    );

    await apiCall('end', { meetingID: meetingIdA, password: 'mp' });
  }

  async testGetMeetings(page: PlaywrightPage, testInfo: TestInfo) {
    const meetingId = await createMeeting();
    await this.initModPage(page, { testInfo, meetingId, shouldCloseAudioModal: false });
    await this.initUserPage(this.modPage.context, { testInfo, meetingId, shouldCloseAudioModal: false });
    await this.modPage.joinMicrophone();
    await this.userPage.joinMicrophone();

    /* hasJoinedVoice: ['true'] is not part of these expectedUser patterns
     * because it isn't consistently true
     * in the API's returned data structures.
     * Is there something we can await on the browser page that
     * should ensure that the API will report hasJoinedVoice?
     */

    const expectedUsers = [
      expect.objectContaining({
        fullName: [`${this.modPage.username}`],
        role: ['MODERATOR'],
        isPresenter: ['true'],
      }),
      expect.objectContaining({
        fullName: [`${this.userPage.username}`],
        role: ['VIEWER'],
        isPresenter: ['false'],
      }),
    ];

    const expectedMeeting = {
      meetingName: [meetingId],
      running: ['true'],
      participantCount: ['2'],
      moderatorCount: ['1'],
      isBreakout: ['false'],
      attendees: [{ attendee: expect.arrayContaining(expectedUsers) }],
    };

    /* check that this meeting is in the server's list of all meetings */
    const { data } = await getMeetings();
    expect(data.response.returncode).toEqual(['SUCCESS']);
    const meetings = (data.response.meetings || []).flatMap(
      (m: GetMeetingsResponse['response']['meetings'][number]) => m.meeting || [],
    );
    expect(meetings).toEqual(expect.arrayContaining([expect.objectContaining(expectedMeeting)]));

    await this.modPage.page.close();
    await this.userPage.page.close();
  }

  async testGetMeetingInfo(page: PlaywrightPage, testInfo: TestInfo) {
    const meetingId = await createMeeting();
    await this.initModPage(page, { testInfo, meetingId, shouldCloseAudioModal: false });
    await this.initUserPage(this.modPage.context, { testInfo, meetingId, shouldCloseAudioModal: false });
    await this.modPage.joinMicrophone();
    await this.userPage.joinMicrophone();

    /* hasJoinedVoice: ['true'] is not part of these expectedUser patterns
     * because it isn't consistently true
     * in the API's returned data structures.
     * Is there something we can await on the browser page that
     * should ensure that the API will report hasJoinedVoice?
     */

    const expectedUsers = [
      expect.objectContaining({
        fullName: ['Moderator'],
        role: ['MODERATOR'],
        isPresenter: ['true'],
      }),
      expect.objectContaining({
        fullName: ['Attendee'],
        role: ['VIEWER'],
        isPresenter: ['false'],
      }),
    ];
    const expectedMeeting = {
      meetingName: [meetingId],
      running: ['true'],
      participantCount: ['2'],
      moderatorCount: ['1'],
      isBreakout: ['false'],
      attendees: [{ attendee: expect.arrayContaining(expectedUsers) }],
    };

    /* check that we can retrieve this meeting by its meetingId */
    const { data } = await getMeetingInfo(meetingId);
    expect(data.response.returncode).toEqual(['SUCCESS']);
    expect(data.response).toMatchObject(expectedMeeting);

    /* check that we can retrieve this meeting by its internal meeting ID */
    const { data: data2 } = await getMeetingInfo(data.response.internalMeetingID[0]);
    expect(data2.response).toMatchObject(expectedMeeting);
    expect(data2.response.returncode).toEqual(['SUCCESS']);

    await this.modPage.page.close();
    await this.userPage.page.close();
  }
}
