val Http4sVersion = "0.23.11"
val CirceVersion = "0.14.1"
val MunitVersion = "0.7.29"
val LogbackVersion = "1.2.10"
val MunitCatsEffectVersion = "1.0.7"
val scala3Version = "3.1.2"

lazy val root = project
  .in(file("."))
  .settings(
    organization := "chrilves",
    name := "kuzh-back",
    version := "0.1.0-SNAPSHOT",

    scalaVersion := scala3Version,
    scalacOptions -= "-Ykind-projector",
    scalacOptions ++= Seq(
      "-Ykind-projector:underscores",
      "-Wunused:all"
    ),
    
    libraryDependencies ++= Seq(
      "org.http4s"       %% "http4s-ember-server" % Http4sVersion,
      //"org.http4s"      %% "http4s-ember-client" % Http4sVersion,
      "org.http4s"       %% "http4s-circe"        % Http4sVersion,
      "org.http4s"       %% "http4s-dsl"          % Http4sVersion,
      "io.circe"         %% "circe-generic"       % CirceVersion,
      "io.circe"         %% "circe-parser"        % CirceVersion,
      //"io.circe"        %% "circe-literal"       % CirceVersion,
      "com.nimbusds"     %  "nimbus-jose-jwt"     % "9.22",
      "org.bouncycastle" %  "bcprov-jdk18on"      % "1.71",
      "org.scalameta"    %% "munit"               % MunitVersion           % Test,
      "org.typelevel"    %% "munit-cats-effect-3" % MunitCatsEffectVersion % Test,
      "ch.qos.logback"   %  "logback-classic"     % LogbackVersion         % Runtime,
      //"org.scalameta"   %% "svm-subs"            % "20.2.0"
    ),
    //addCompilerPlugin("org.typelevel" %% "kind-projector"     % "0.13.2" cross CrossVersion.full),
    //addCompilerPlugin("com.olegpy"    %% "better-monadic-for" % "0.3.1"),
    testFrameworks += new TestFramework("munit.Framework")
  )