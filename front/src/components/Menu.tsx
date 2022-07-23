import { useEffect, useState } from "react";
import { CryptoMembership } from "../model/Crypto";
import CryptoMembershipPanel from "./CryptoMembershipPanel";
import { withAsync } from "../lib/withAsync";
import {
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Operation } from "../model/Operation";
import { StorageAPI } from "../services/StorageAPI";

interface Nav {
  prepare(operation: Operation): void;
  assembly(cryptoMembership: CryptoMembership): void;
}

export default function Menu(
  props: Nav & { storageAPI: StorageAPI }
): JSX.Element {
  const [lastCryptoMembership, setlastCryptoMembership] = useState<
    CryptoMembership | null | undefined
  >(undefined);

  useEffect(
    withAsync(async () => {
      const last = await props.storageAPI.fetchLastCryptoMembership();
      setlastCryptoMembership(last);
    })
  );

  return lastCryptoMembership === undefined ? (
    <div />
  ) : (
    <Routes>
      <Route
        path="/"
        element={
          <div className="App">
            {lastCryptoMembership && (
              <LastAssembly
                lastCryptoMembership={lastCryptoMembership}
                prepare={props.prepare}
                assembly={props.assembly}
              />
            )}
            <Join prepare={props.prepare} assembly={props.assembly} />
            <Create prepare={props.prepare} assembly={props.assembly} />
          </div>
        }
      />
      <Route
        path="/assembly/:assemblyIdP"
        element={
          <Wizzard
            prepare={props.prepare}
            assembly={props.assembly}
            lastCryptoMembership={lastCryptoMembership}
          />
        }
      />
      <Route path="*" element={<Lost />} />
    </Routes>
  );
}

function Nickname(props: {
  nickname: string;
  setNickname(nickname: string): void;
}): JSX.Element {
  return (
    <div>
      <label>pseudo : </label>
      <input
        type="text"
        name="nickname"
        placeholder="vote pseudo"
        value={props.nickname}
        onChange={(e) => props.setNickname(e.target.value)}
      />
    </div>
  );
}

function LastAssembly(
  props: Nav & { lastCryptoMembership: CryptoMembership }
): JSX.Element {
  return (
    <div className="kuzh-rejoin-last-assembly">
      <h2 className="kuzh-style-action">Revenir à la dernière Assemblée</h2>
      <CryptoMembershipPanel cryptoMembership={props.lastCryptoMembership} />
      <button
        type="button"
        onClick={() => props.assembly(props.lastCryptoMembership)}
      >
        Revenir à la dernière Assemblée
      </button>
    </div>
  );
}

function Join(props: Nav): JSX.Element {
  const [assemblyKey, setAssemblyKey] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");

  async function join() {
    const arr = assemblyKey.split(",", 2);
    props.prepare(Operation.join(arr[0], arr[1], nickname));
  }

  function validInput(): boolean {
    return true;
  }

  return (
    <div className="kuzh-join-assembly">
      <h2 className="kuzh-style-action">Rejoindre une Assemblée existante</h2>
      <div>
        <label>Clef de connexion : </label>
        <input
          type="text"
          name="assembly_key"
          placeholder="clef de connexion de l'assemblée"
          value={assemblyKey}
          onChange={(e) => setAssemblyKey(e.target.value)}
        />
      </div>
      <Nickname nickname={nickname} setNickname={setNickname} />
      {validInput() && (
        <div>
          <button type="button" onClick={join}>
            Rejoindre l'Assemblée
          </button>
        </div>
      )}
    </div>
  );
}

function Create(props: Nav): JSX.Element {
  const [assemblyName, setAssemblyName] = useState<string>("asm");
  const [nickname, setNickname] = useState<string>("toto");

  function create() {
    props.prepare(Operation.create(assemblyName, nickname));
  }

  function validInput(): boolean {
    return true;
  }

  return (
    <div className="kuzh-create-assembly">
      <h2 className="kuzh-style-action">Créer une nouvelle Assemblée</h2>
      <div>
        <label>assemblée : </label>
        <input
          type="text"
          name="assemblyName"
          placeholder="nom de l'assemblée"
          value={assemblyName}
          onChange={(e) => setAssemblyName(e.target.value)}
        />
      </div>
      <Nickname nickname={nickname} setNickname={setNickname} />
      {validInput() ? (
        <div>
          <button type="button" onClick={create}>
            Créer l'Assemblée
          </button>
        </div>
      ) : (
        <p>Clef d'assemblée ou pseudo invalide.</p>
      )}
    </div>
  );
}

function Wizzard(
  props: Nav & { lastCryptoMembership: CryptoMembership | null }
): JSX.Element {
  const navigate = useNavigate();
  const { assemblyIdP } = useParams();

  const [URLSearchParams] = useSearchParams();
  const secretQS = URLSearchParams.get("secret");

  const [secret, setSecret] = useState<string>(secretQS ? secretQS : "");
  const [nickname, setNickname] = useState<string>("toto");

  let postAction: (() => void) | undefined = undefined;

  useEffect(() => {
    if (postAction) postAction();
  });

  let assemblyId: string;
  if (assemblyIdP) {
    assemblyId = assemblyIdP;
  } else {
    return <div />;
  }

  if (
    props.lastCryptoMembership &&
    props.lastCryptoMembership.assembly.uuid === assemblyId
  ) {
    const cryptoMembership = props.lastCryptoMembership;
    postAction = () => {
      props.assembly(cryptoMembership);
    };
    return <div />;
  }

  function join() {
    props.prepare(Operation.join(assemblyId, secret, nickname));
  }

  function validInput(): boolean {
    return true;
  }

  return (
    <div>
      {!secretQS && (
        <div>
          <label>secret : </label>
          <input
            type="text"
            name="secret"
            placeholder="secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </div>
      )}
      <Nickname nickname={nickname} setNickname={setNickname} />
      {validInput() ? (
        <div>
          <button type="button" onClick={join}>
            Rejoindre l'assemblée
          </button>
        </div>
      ) : (
        <p>Entrées invalides.</p>
      )}
    </div>
  );
}

function Lost(): JSX.Element {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate("/")}>
        Menu
      </button>
      <p>Euh ... tu voulais aller ou déja?</p>
    </div>
  );
}
