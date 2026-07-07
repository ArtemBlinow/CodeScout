import requests
import json
import re
from datetime import datetime


def extract_year_from_name(name):
    years = re.findall(r'\b(19\d{2}|20\d{2})\b', name)
    if years:
        return int(years[-1])
    range_match = re.search(r'(19\d{2}|20\d{2})\s*[-–—]\s*(19\d{2}|20\d{2})', name)
    if range_match:
        return int(range_match.group(2))
    return None


def download_and_filter_contests():
    url = "https://codeforces.com/api/contest.list?gym=true"
    output_file = "gyms.json"

    try:
        print(f"Загрузка данных из {url}...")
        response = requests.get(url)
        response.raise_for_status()

        data = response.json()

        if data.get('status') != 'OK':
            print(f"Ошибка API: {data.get('comment', 'Неизвестная ошибка')}")
            return

        contests = data.get('result', [])
        original_count = len(contests)
        ap = []
        filtered_contests = []
        for c in contests:
            if c.get('phase') == 'FINISHED':
                if c['frozen']:
                    print(c['name'])
                    break

                c.pop('phase')
                c.pop('frozen')
                c['durationMinutes'] = c['durationSeconds'] // 60
                c.pop('durationSeconds')
                c.pop('freezeDurationSeconds', None)
                c.pop('relativeTimeSeconds', None)
                c.pop('preparedBy', None)
                c.pop('websiteUrl', None)
                c.pop('description', None)
                c.pop('season', None)

                if 'startTimeSeconds' in c:
                    dt = datetime.fromtimestamp(c['startTimeSeconds'])
                    c['startDate'] = dt.strftime('%Y-%m-%d')  # Только дата, без времени
                    c.pop('startTimeSeconds')
                else:
                    year = extract_year_from_name(c.get('name', ''))
                    if year:
                        c['startDate'] = datetime(year, 1, 1).strftime('%Y-%m-%d')
                        ap.append(f"{c['name']} -> дата установлена на {year}-01-01")
                    else:
                        c['startDate'] = None
                        print(c['name'], "NoTime и год не найден")

                filtered_contests.append(c)

        filtered_count = len(filtered_contests)

        print(f"Всего контестов: {original_count}")
        print(f"Осталось контестов: {filtered_count}")

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(filtered_contests, f, ensure_ascii=False, indent=2)

        print(f"Результат сохранен в файл: {output_file}")

    except requests.exceptions.RequestException as e:
        print(f"Ошибка при загрузке данных: {e}")
    except json.JSONDecodeError as e:
        print(f"Ошибка парсинга JSON: {e}")
    except Exception as e:
        print(f"Неожиданная ошибка: {e}")

if __name__ == "__main__":
    download_and_filter_contests()
