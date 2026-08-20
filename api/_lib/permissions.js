const ROLE_PERMISSIONS = Object.freeze({
  member: Object.freeze([
    'entry:read_shared',
    'tag:read',
  ]),
  parent: Object.freeze([
    'entry:read_shared',
    'entry:read_all',
    'entry:create',
    'entry:update',
    'entry:delete',
    'album:upload',
    'care:read',
    'care:create',
    'care:update',
    'care:delete',
    'tag:read',
    'tag:assign',
  ]),
  admin: Object.freeze([
    'entry:read_shared',
    'entry:read_all',
    'entry:create',
    'entry:update',
    'entry:delete',
    'album:upload',
    'care:read',
    'care:create',
    'care:update',
    'care:delete',
    'child:create',
    'child:update',
    'child:archive',
    'member:invite',
    'member:update_role',
    'member:disable',
    'album:manage',
    'tag:read',
    'tag:assign',
    'tag:manage',
  ]),
})

export function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] ?? []
}
