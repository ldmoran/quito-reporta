# ---- 1) compilar ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
# -Dmaven.test.skip: las pruebas corren en el pipeline (CI), no al construir la imagen.
RUN mvn -B -q -Dmaven.test.skip=true package

# ---- 2) ejecutar ----
FROM eclipse-temurin:21-jre
RUN useradd --system --create-home --uid 1001 alerta \
    && mkdir -p /datos/evidencias && chown -R alerta /datos
USER alerta
WORKDIR /app
COPY --from=build /app/target/alerta-quito-servicio.jar app.jar

ENV DIRECTORIO_EVIDENCIAS=/datos/evidencias \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=5 \
    CMD curl -fsS http://localhost:${PORT:-8080}/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
