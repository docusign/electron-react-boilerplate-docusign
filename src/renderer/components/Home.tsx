/* eslint-disable react/prop-types */
import React from 'react';
import { useHistory } from 'react-router-dom';

const Home = (props: { startAuthentication: () => void }) => {
  const history = useHistory();

  function startAuthentication(): void {
    history.push('/loggingIn');
    props.startAuthentication();
  }

  return (
    <div>
      <h1>electron-react-boilerplate</h1>
      <div className="Hello">
        <a
          href="https://electron-react-boilerplate.js.org/"
          target="_blank"
          rel="noreferrer"
        >
          <button type="button">
            <span role="img" aria-label="books" className="mr">
              📚
            </span>
            Electron-react docs
          </button>
        </a>
        <button type="button" onClick={startAuthentication}>
          <span role="img" aria-label="login" className="mr">
            🔆
          </span>
          Login
        </button>
      </div>
    </div>
  );
};

export default Home;
