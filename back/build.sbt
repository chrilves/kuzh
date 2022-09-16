val Http4sVersion = "0.23.16"
val BouncyCastle = "1.71.1"
val CirceVersion = "0.14.3"
val MunitVersion = "0.7.29"
val NimbusJoseJWT = "9.25"
val LogbackVersion = "1.2.11"
val MunitCatsEffectVersion = "1.0.7"
val scala3Version = "3.1.3"

enablePlugins(JavaAppPackaging)

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
      "org.http4s"       %% "http4s-circe"        % Http4sVersion,
      "org.http4s"       %% "http4s-dsl"          % Http4sVersion,
      "io.circe"         %% "circe-generic"       % CirceVersion,
      "io.circe"         %% "circe-parser"        % CirceVersion,
      "com.nimbusds"     %  "nimbus-jose-jwt"     % NimbusJoseJWT,
      "org.bouncycastle" %  "bcprov-jdk18on"      % BouncyCastle,
      "org.scalameta"    %% "munit"               % MunitVersion           % Test,
      "org.typelevel"    %% "munit-cats-effect-3" % MunitCatsEffectVersion % Test,
      "ch.qos.logback"   %  "logback-classic"     % LogbackVersion         % Runtime,
      //"org.scalameta"   %% "svm-subs"            % "20.2.0"
    ),
    testFrameworks += new TestFramework("munit.Framework"),

    Docker/maintainer  := "chrilves",
    Docker/packageName := s"${(Docker/maintainer).value}/${name.value}",
    Docker/version     := "latest",
    dockerExposedPorts := Seq(9000)
  )