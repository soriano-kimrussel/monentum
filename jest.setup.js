// Work around a jest-expo bug seen in this project: its native-module mock lookup builds a path
// from source-mapped (relative) stack frames, fails to find a package.json, and then calls
// `path.join(null, ...)`, which throws instead of falling back to the default mocks.
// Returning a path that doesn't exist lets jest-expo's own fallback run as intended.
const path = require('path');
const join = path.join;
path.join = (...parts) => (parts[0] == null ? join('__jest_expo_no_mock__', ...parts.slice(1).map(String)) : join(...parts));
