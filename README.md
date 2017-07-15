# Bunker

Build your react-native app with several package.

### Install

```
npm install -s react-native-bunker
```

### Usage

* step 1

  Init .bunkerc

  ```
  ./node_modules/.bin/react-native-bunker init
  ```

  This step maybe executed automically when install.

* step 2

  [setup .bunkerc](./src/bunker.yaml)

* step 3

  Fix import dependencies in your codes.

  You should change :

  ```
  import React, {Component} from 'react';

  ...
  ```

  or :

  ```
  var React = require('react');
  ...
  ```

  to :

  ```
  import Bunker from 'react-native-bunker';

  const {
    React, React: {
      Component
    },
    ReactNative: {
      View,
      ...
    }
    ...
  } = Bunker.Modules;
  ```

* step 4

  Change `entry file` to `${App.name}Entry` like :

  ```
  requie('${App.name}Entry')
  ```

  `${App.name}` is the name in `app.json`, just camelCase;

* step 5
  
  Bundle your app packages

  ```
  ./node_modules/.bin/react-native-bunker bundle
  ```

#### Then `Command + R` to reload your app.

### Advance and More

  I'll come back soon.