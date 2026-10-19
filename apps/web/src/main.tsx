import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './App.tsx';

const root = document.getElementById( 'root' );

if ( !root ) {
    throw new Error( 'index.html has no #root element' );
}

createRoot( root ).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
