/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'ForkYeahWidgets',
  // iOS 17 is the floor for AppIntent-backed interactivity (the grocery accordion)
  // and containerBackground; below it the widget simply isn't offered.
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.hammyinc.whatsfordinner'],
  },
};
