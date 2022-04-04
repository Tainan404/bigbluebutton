package org.bigbluebutton.api.messaging.messages;

public class UserJoined implements IMessage {
  public final String meetingId;
  public final String userId;
  public final String externalUserId;
  public final String plainName;
  public final String htmlName;
  public final String role;
  public final String avatarURL;
  public final Boolean guest;
  public final String guestStatus;
	public final String clientType;
  

  public UserJoined(String meetingId,
										String userId,
										String externalUserId,
										String plainName,
										String htmlName,
										String role,
										String avatarURL,
										Boolean guest,
										String guestStatus,
										String clientType) {
  	this.meetingId = meetingId;
  	this.userId = userId;
  	this.externalUserId = externalUserId;
  	this.plainName = plainName;
	this.htmlName = htmlName;
  	this.role = role;
  	this.avatarURL = avatarURL;
  	this.guest = guest;
  	this.guestStatus = guestStatus;
  	this.clientType = clientType;
  }
}
