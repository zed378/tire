.PHONY: deploy pull prune up down logs restart help

# Target default ketika hanya mengetik `make`
.DEFAULT_GOAL := deploy

# Deploy lengkap: pull terbaru, bersihkan image/container lama tanpa prompt (-f), dan rebuild container production
deploy: pull prune up

pull:
	git pull

prune:
	docker system prune -a -f

up:
	docker compose -f docker-compose.prod.yml up -d --force-recreate --build

down:
	docker compose -f docker-compose.prod.yml down

logs:
	docker compose -f docker-compose.prod.yml logs -f

restart: down up

help:
	@echo "Perintah yang tersedia:"
	@echo "  make (atau make deploy) - Menjalankan git pull, prune, dan build & up container"
	@echo "  make pull               - Menjalankan git pull"
	@echo "  make prune              - Menjalankan docker system prune -a -f (tanpa prompt)"
	@echo "  make up                 - Menjalankan docker compose up prod dengan rebuild"
	@echo "  make down               - Menghentikan container production"
	@echo "  make logs               - Melihat logs container production"
	@echo "  make restart            - Restart container production (down lalu up)"
