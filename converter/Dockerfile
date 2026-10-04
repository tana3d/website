FROM python:3.11-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libx11-6 libxi6 libxxf86vm1 libxrender1 libgl1 libegl1 libsm6 libgomp1 libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --only-binary=:all: bpy==4.5.14 numpy==1.26.4
WORKDIR /converter
COPY convert.py server.py SOURCE.md ./
RUN useradd --create-home converter
USER converter
EXPOSE 8080
CMD ["python", "-I", "server.py"]
