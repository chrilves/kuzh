import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { LocalStorageAPI } from '../lib/StorageAPI'

test('renders learn react link', () => {
  render(<App storageAPI={new LocalStorageAPI}/>);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
