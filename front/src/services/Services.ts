import { AssemblyAPI, RealAssemblyAPI } from "./AssemblyAPI";
import { BackAPI, RealBackAPI } from "./BackAPI";
import {
  BackCachingIdentityProofStoreFactory,
  IdentityProofStoreFactory,
} from "./IdentityProofStore";
import { DummyStorageAPI, LocalStorageAPI, StorageAPI } from "./StorageAPI";

export type Services = {
  storageAPI: StorageAPI;
  assemblyAPI: AssemblyAPI;
  identityProofStoreFactory: IdentityProofStoreFactory;
};

export function realServices(): Services {
  const storageAPI: StorageAPI = new LocalStorageAPI();
  const backAPI: BackAPI = new RealBackAPI("http://localhost:8081");
  const assemblyAPI: AssemblyAPI = new RealAssemblyAPI(storageAPI, backAPI);
  const identityProofStoreFactory = new BackCachingIdentityProofStoreFactory(
    storageAPI,
    backAPI
  );

  return {
    storageAPI: storageAPI,
    assemblyAPI: assemblyAPI,
    identityProofStoreFactory: identityProofStoreFactory,
  };
}

export function testServices(nickname: string): Services {
  const storageAPI: StorageAPI = new DummyStorageAPI();
  storageAPI.storeNickname(nickname);

  const backAPI: BackAPI = new RealBackAPI("http://localhost:8081");
  const assemblyAPI: AssemblyAPI = new RealAssemblyAPI(storageAPI, backAPI);
  const identityProofStoreFactory = new BackCachingIdentityProofStoreFactory(
    storageAPI,
    backAPI
  );

  return {
    storageAPI: storageAPI,
    assemblyAPI: assemblyAPI,
    identityProofStoreFactory: identityProofStoreFactory,
  };
}
