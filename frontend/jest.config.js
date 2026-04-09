const path = require('path');

module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: ['@babel/preset-env', '@babel/preset-react']
      }
    ]
  },
  moduleNameMapper: {
    '^react$': require.resolve('react'),
    '^react-dom$': require.resolve('react-dom'),
    '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  moduleDirectories: [
    'node_modules',
    path.resolve(__dirname, '../node_modules')
  ]
};