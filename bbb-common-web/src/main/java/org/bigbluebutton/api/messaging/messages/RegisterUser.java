package org.bigbluebutton.api.messaging.messages;


public class RegisterUser implements IMessage {

	public final String meetingID;
	public final String internalUserId;
	public final String plainFullname;
	public final String htmlFullname;
	public final String role;
	public final String externUserID;
	public final String authToken;
	public final String avatarURL;
	public final Boolean guest;
	public final Boolean authed;
	public final String guestStatus;
	public final Boolean excludeFromDashboard;
	public final Boolean leftGuestLobby;

	public RegisterUser(String meetingID, String internalUserId, String plainFullname, String htmlFullname, String role, String externUserID,
						String authToken, String avatarURL, Boolean guest,
						Boolean authed, String guestStatus, Boolean excludeFromDashboard, Boolean leftGuestLobby) {
		this.meetingID = meetingID;
		this.internalUserId = internalUserId;
		this.plainFullname = plainFullname;
		this.htmlFullname = htmlFullname;
		this.role = role;
		this.externUserID = externUserID;
		this.authToken = authToken;		
		this.avatarURL = avatarURL;		
		this.guest = guest;
		this.authed = authed;
		this.guestStatus = guestStatus;
		this.excludeFromDashboard = excludeFromDashboard;
		this.leftGuestLobby = leftGuestLobby;
	}
}
