package org.bigbluebutton

import org.scalatest.flatspec.AnyFlatSpec

import org.bigbluebutton.core2.Permissions

// Exercises the predicate that decides whether a lock settings change requires
// locked viewers to re-establish their GraphQL sessions. Only the lock settings
// provided to Hasura as session variables (see GetUserApiMsgHdlr) require it;
// every other combination must not trigger the meeting-wide reconnection.
//
// NOTE: extends AnyFlatSpec directly rather than the shared UnitSpec, which
// currently does not compile against the resolved ScalaTest (UnitSpec still
// imports the pre-3.2 org.scalatest.FlatSpec / Matchers packages). Same choice
// PollHdlrHelpersSpec and WhiteboardModelSpec made.
class LockSettingsUtilSpec extends AnyFlatSpec {

  private val defaultPermissions = Permissions()

  it should "not require a graphql session refresh when no lock setting changed" in {
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions))
  }

  it should "require a graphql session refresh when a lock setting provided as session variable changed" in {
    assert(LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(hideUserList = true)))
    assert(LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(hideViewersCursor = true)))
    assert(LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(hideViewersAnnotation = true)))
    assert(LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions.copy(hideUserList = true), defaultPermissions))
  }

  it should "not require a graphql session refresh when only lock settings not provided as session variables changed" in {
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(disableCam = true)))
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(disableMic = true)))
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(disablePrivChat = true)))
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(disablePubChat = true)))
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(disableNotes = true)))
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(lockOnJoin = false)))
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(lockOnJoinConfigurable = true)))
    assert(!LockSettingsUtil.requiresGraphqlSessionRefresh(defaultPermissions, defaultPermissions.copy(presenterPolicy = "freeForAll")))
  }
}
