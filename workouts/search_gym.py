import requests
import json
from time import sleep


def load_and_filter_gyms(file_path="gyms.json"):
    with open(file_path, 'r', encoding='utf-8') as f:
        gyms = json.load(f)

    filtered = []
    for g in gyms:
        if (g.get('type') == 'ICPC' and
                g.get('kind') == 'Official ICPC Contest' and
                g.get('durationMinutes') == 300 and
                g.get('difficulty') in [4, 5]):
            filtered.append(g)

    print(f"Найдено подходящих тренировок: {len(filtered)}")
    return filtered

def print_gym_details(gym):
    print(f"ID: {gym.get('id')}")
    print(f"Страна: {gym.get('country')}")
    print(f"Город: {gym.get('city')}")
    print(f"Сложность: {gym.get('difficulty')}")


def get_user_contests(handle):
    url = f"https://codeforces.com/api/user.status?handle={handle}"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        if data['status'] != 'OK':
            print(f"Ошибка API для {handle}: {data.get('comment', '')}")
            return set()

        # Извлекаем уникальные contestId из всех попыток
        contest_ids = set()
        for submission in data['result']:
            if 'contestId' in submission:
                contest_ids.add(submission['contestId'])

        print(f"{handle} писал {len(contest_ids)} контестов")
        return contest_ids

    except Exception as e:
        print(f"Ошибка при запросе для {handle}: {e}")
        return set()


def find_matching_gyms():
    gyms = load_and_filter_gyms("gyms.json")

    gym_ids = {g['id'] for g in gyms}  # предполагаем, что поле называется 'id'

    # Получаем контесты для каждого пользователя
    print("\nЗагрузка данных пользователей...")
    ashmelev_contests = get_user_contests("ashmelev")
    anotherworld_contests = get_user_contests("anotherworld")
    honerad_contests = get_user_contests("Honerad")
    artem_sukharev_contests = get_user_contests("Artem_Sukharev")

    # Находим тренировки, которые НЕ писали ashmelev и anotherworld
    not_written_by_both = gym_ids - ashmelev_contests - anotherworld_contests

    # Из них находим те, которые писали Honerad или Artem_Sukharev
    written_by_honerad_or_artem = not_written_by_both & (honerad_contests | artem_sukharev_contests)

    # Выводим результаты
    print(f"\nНайдено тренировок, подходящих под условие: {len(written_by_honerad_or_artem)}")

    for gym in gyms:
        if gym['id'] in written_by_honerad_or_artem:
            print(f"- {gym.get('name', 'Без названия')}")
            print_gym_details(gym)
            written_by = []
            if gym['id'] in honerad_contests:
                written_by.append("Honerad")
            if gym['id'] in artem_sukharev_contests:
                written_by.append("Artem_Sukharev")
            print(f"  Писали: {', '.join(written_by)}")
            print()


if __name__ == "__main__":
    find_matching_gyms()
