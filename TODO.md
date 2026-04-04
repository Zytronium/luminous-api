Write an SQL script that adds the roles table and the permissions table.

ROLES STRUCTURE
```
id: string, // UUID
name: string,
description: string,
priority: int,
color: string, // hex code
permissions: { string: int }, // map of permission codes to their values (0 is false, 1 is inherit, 2 is true). Unspecified permissions behave as inherit (1). 
is_default: boolean, // whether @everyone has this role (only one role can be default). If this is true, all permissions must specify true (2) or false (0)
created_at: timestamp,
updated_at: timestamp, 
```

PERMISSIONS STRUCTURE
```
id: string, // UUID
code: string, // i.e. "MANAGE_MESSAGES"
name: string,
description: string, 
created_at: timestamp,
updated_at: timestamp, 
```

USER/ROLE JOIN TABLE STRUCTURE
```
user_id: string,
role_id: string,
assigned_at: timestamp,
assigned_by: string,  // user_id of who granted it
```

---

| Permission           | Description                                     | @Everyone Default | Notes                                                                                                                                                                |
|----------------------|-------------------------------------------------|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| SEND_MESSAGES        | Allows sending messages                         | true              |                                                                                                                                                                      |
| EMBED_LINKS          | Allows links sent to embed content              | true              |                                                                                                                                                                      |
| ATTACH_FILES         | Allows attaching files                          | true              |                                                                                                                                                                      |
| ADD_REACTIONS        | Allows adding reactions to messages             | true              |                                                                                                                                                                      |
| READ_MESSAGE_HISTORY | Allows reading message history                  | true              |                                                                                                                                                                      |
| MENTION_EVERYONE     | Allows mentioning @everyone                     | false             |                                                                                                                                                                      |
| MANAGE_MESSAGES      | Allows deleting other users' messages           | false             |                                                                                                                                                                      |
| PIN_MESSAGES         | Allows pinning and unpinning messages           | false             |                                                                                                                                                                      |
| MANAGE_ROLES         | Allows editing roles                            | false             | Cannot manage roles with higher or equal priority than this user's highest priority role, unless user has administrator perm or this is the highest role that exists |
| ASSIGN_ROLES         | Allows assigning roles to other users and self. | false             | Cannot assign roles with higher or equal priority than this user's highest priority role, unless user has administrator perm or this is the highest role that exists |
| MANAGE_EMOJIS        | Allows adding/editing/removing custom emojis    | false             |                                                                                                                                                                      |
| WARN_MEMBERS         | Allows warning other users                      | false             | Should be granted to chat mods only                                                                                                                                  |
| MUTE_MEMBERS         | Allows muting other users                       | false             | Mutes should be temporary with a specified time. Should be granted to chat mods only                                                                                 |
| BAN_MEMBERS          | Allows banning other users from Luminous        | false             | Only for serious offenses. Should be granted to trusted chat mods only. Cannot ban users with admin perms unless you have the ADMINISTRATOR permission               |
| VIEW_AUDIT_LOG       | Allows viewing the audit log                    | false             |                                                                                                                                                                      |
| ADMINISTRATOR        | Grants all permissions except "PLAY_GOD"        | false             | For highly trusted mods only                                                                                                                                         |
| PLAY_GOD             | Allows adding/editing/removing permissions      | false             | With this role comes great responsibility. Editing permissions can break the Discord bridge in the future.                                                           |

---

Update roles.ts and users.ts endpoints and add a permissions lib file for permission utilities
