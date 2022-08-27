import { AssemblyAPI, AssemblyAPIFactory } from "./AssemblyAPI";
import { IdentityProofStoreFactory } from "./IdentityProofStore";
import Install from "./Install";
import { StorageAPI } from "./StorageAPI";

export type Services = {
  storageAPI: StorageAPI;
  assemblyAPI: AssemblyAPI;
  identityProofStoreFactory: IdentityProofStoreFactory;
  assemblyAPIFactory: AssemblyAPIFactory;
  install: Install;
};
