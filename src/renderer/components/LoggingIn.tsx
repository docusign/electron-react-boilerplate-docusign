/* eslint-disable react/prop-types */
import React from 'react';
import { useHistory } from 'react-router-dom';

const LogginIn = (props: { cancelAuthentication: () => void }) => {
  const history = useHistory();

  function cancelAuthentication() {
    history.push('/');
    props.cancelAuthentication();
  }

  return (
    <section className="welcome mtop15">
      <div>
        <h2>Please login via your browser</h2>
        <h3>
          <span
            className="smallA"
            role="button"
            tabIndex={0}
            onKeyPress={cancelAuthentication}
            onClick={cancelAuthentication}
          >
            cancel login
          </span>
        </h3>
      </div>
    </section>
  );
};

export default LogginIn;
