# [kuzh](https://kuzh.cc/)

**For now only available in french, sorry :(**

[kuzh](https://kuzh.cc/) est une application de questions/réponses anonyme open-source, sous GPVv3,
permettant à chaque participant.e de poser et répondre aux questions du groupe sans se dévoiler.
Du moins autant que le permet la fiabilité du protocole de vote.

Créer une assemblée est trivial. Il vous suffit d'entrer le nom que vous souhaitez lui donner
et de choisir un pseudo. Vous pourrez ensuite inviter des membres dans l'assemblée via le lien
de connexion (voir le bouton à cet effet) ou le QR code fourni. Essayez, c'est vraiment simple.

J'ai pris tout le soin que je pouvais pour m'assurer que le protocole de vote est effectivement anonyme.
Bien entendu, comme toujours en crypto/sécurité, rien ni personne n'est à l'abri d'une faille.
Je vous invite à lire la description du protocole (plus bas) ou lire le code pour vous faire un avis.
Chose importante à noter, le serveur ne connaît pas qui vote quoi! C'est tout le but du protocole.

La seule partie sensible est le code front-end, qui lui connaît votre vote, mais est sous votre contrôle.
Toutefois vous comprenez bien que le logiciel est fourni tel sans aucune garantie. Si vous n'acceptez
pas les risques, ne l'utilisez pas, ou encore mieux lisez le et vérifiez de sa fiabilité par vous même.

## Le Protocole

Il y a deux types de "vote" (3 si con compte les réponses ouvertes et fermées),
une récolte des questions que posent les membres,
et une récolte des réponses quand une question est posée.
Le processus est exactement le même dans tous les cas.
Dans la suite nous appellerons récolte la phase de collecte des questions/réponses
et bulletin la question/réponse d'un membre.

### Étape 0:

Chaque membre dispose de deux paires de clefs cryptographiques.
La première paire sert à signer les messages pour prouver qu'ils proviennent bien du membre prétendu.
La seconde paire sert aux autres membres à lui envoyer des données chiffrées.
Seul le membre pourra déchiffrer les messages chiffrés avec sa clef publique de chiffrement.
Chaque membre reçoit une empreinte, qui n'est autre que le hache cryptographique de sa clef publique de
vérification de ses signatures.

La série de chiffres et lettres que vous voyez sous vôtre pseudo est cette empreinte.
Les chefs sont générés par le client (le front quoi) avant de rejoindre une assemblée.
La paire de clef de chiffrement, ainsi que le pseudo sont signés pour s'assurer que ceux ci sont bien
ceux choisi par le membre.

Notez que les pseudos sont libres et donc rien n'empêche un autre membre d'avoir le même pseudo que vous.
Mais il n'aura pas la même empreinte. Pour vérifier l'identité des membres, **regarder les empreintes**.

### Étape 1:

Lors d'une récolte, chaque membre choisi une question à poser ou la réponse qu'iel souhaite donner à une question.
Cette réponse, accompagnée d'une séquence aléatoire forme le bulletin du/de la membre.
Pour l’exemple, disons qu'il y a 3 membres Alice, Bob et Charly, chacun.e fabriquant un bulletin de la sorte.

Le serveur choisi un ordre de passage pour les membres, n'importe lequel, par exemple: Alice, Charly puis Bob.
L'idée est de récolter les bulletins dans cet ordre, mais ce ne serait pas anonyme.
Pour rendre la récolte anonyme, chaque membre commence par calculer le hash, via une fonction de hash cryptographique
comme SHA-256, de son bulletin.

Ensuite chaque membre chiffre ce hash "en oignon" pour chaque membres qui le suit dans la chaîne.
En oignon signifie que chaque membre va chiffrer son hash pour le dernier membre de la chaîne, le résultat
pour le membre suivant, et ainsi de suite jusqu'à arriver sur lui même.

Bob, dernier membre de la chaîne, ne va pas signer son hash, car il n'y personne après.
Charly va chiffrer son hash pour que seul Bob puisse le lire.
Quant à Alice, elle va signer son hash pour que seul Bob puisse le lire, mais va chiffrer le résultat pour Charly,
de sorte qu'il faudra d'abord que Charly déchiffre le message avec sa clef privée pour que Bob puisse le déchiffrer
à son tour avec la sienne.

Le serveur commence par demander à Alice son hash chiffré.
Puis le donne au/à la membre suivante dans la chaîne, c'est à dire Charly.
Charly déchiffre le message d'Alice de telle sorte qu'il ne reste plus que la couche de chiffrement pour Bob.
Il rend au serveur le hash d'Alice ainsi obtenu, ainsi que le sien, dans l'ordre lexicographique!
Le serveur envoie ensuite ces deux hash à Bob, qui les déchiffre puis rends les 3 au serveur, toujours triés lexicographiquement!

Seul Bob à pu lire les hash en clair, car les hash des autres membres étaient tous chiffrés en dernier lieu pour lui.
Mais Bob, bien qu'il ai les hash en clair, ne sait pas de qui vient chacun!
Par contre rien ne garanti que Charly et Bon n'ai pas triché et remplacé un hash chiffré par un autre.
Cette faculté de triche est justement ce qui garanti l'anonymat!

Le serveur diffuse alors les hash en clair à tous les membres. Et chacun.e vérifie que son hash est bien dans la liste.
Si le hash d'un.e membre n'y est pas, iel déclare le vote invalide.
Un hash ne permetant pas de découvrir le bulletin (grâce à la chaîne aléatoire rajoutée a chaque bulletin),
les réponses des membres ne sont pas dévoilées.

Si chaque membre trouve bien son hash, et qu'il y a bien autant de hash que de membres, chaque membre signe alors
un message commun contenant la question posée, l’identifiant de la récolte, les participants et les hashs en clair.
L'ajout de tous ces détails empêche à un.e membre malveillant.e de réutiliser une signature d'une récolte sur l'autre.

Si tous les membres fournissent une telle signature, et donc qu'iels ont bien trouvé leur hash dans la liste, c'est que
la première phase de la récolte s'est déroulé correctement et les hash sont bien ceux des bulletins.

La phase suivante est la même que celle de collecte des hash, seulement celle fois ce sont les bulletins qui sont chiffrées et
collectés. Encore une fois seul Bob voit les bulletins en clair mais sans savoir d'où ils proviennent.
Et encore une fois, les membres ont pu remplacer un bulletin par un autre lors de la collecte.

Bob envoie les bulletins en clair au serveur qui les diffuse à tous les membres. Chacun.e hash alors les bulletins qui viennent
du serveur et vérifie que les hashs sont bien ceux collectés dans la phase précédente.
Si les bulletins ont bien les bons hash, la récolte est donc correcte.

## Faire tourner l'application en local.

Il vous faut avoir:

- [yarn](https://yarnpkg.com/) pour le front.
- [sbt](https://www.scala-sbt.org/) pour le back.

Une fois que ceux deux outils sont installés:

- Lancer `sbt run` pour lancer le back.
- Lancer `yarn install` pour télécharger les dépendances du front.
- Puis `yarn start` pour lancer l'application.

C'est bon à l'application est diponible à l'adresse http://localhost:3000

# Credits to the fonts used in Kuzh

[Kuzh](https://kuzh.cc) uses some great open source fonts. Many thanks to their authors for theses fonts ❤️.

- The [Alice](https://github.com/cyrealtype/Alice) (SIL Open Font License 1.1)
- The [Open Baskerville](https://github.com/klepas/open-baskerville) (GPLv3)
- The [Overpass](https://github.com/RedHatOfficial/Overpass) (SIL Open Font License 1.1)

# Amusez vous bien :)
