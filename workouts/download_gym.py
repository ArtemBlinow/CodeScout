import requests
import hashlib
import time
import json
import os
from datetime import datetime


API_KEY = ""
API_SECRET = ""


def generate_signature(method_name, params):
    params['apiKey'] = API_KEY
    params['time'] = str(int(time.time()))
    sorted_params = sorted(params.items())
    param_string = '&'.join([f"{k}={v}" for k, v in sorted_params])
    rand = str(int(time.time()) % 1000000).zfill(6)
    sign_string = f"{rand}/{method_name}?{param_string}#{API_SECRET}"
    hash_obj = hashlib.sha512(sign_string.encode())
    api_sig = rand + hash_obj.hexdigest()
    return api_sig, params


def download_standings(contest_id):
    method = "contest.standings"
    params = {
        "contestId": contest_id,
        "showUnofficial": "true"
    }

    api_sig, params = generate_signature(method, params)
    params["apiSig"] = api_sig
    url = f"https://codeforces.com/api/{method}"
    print(f"Загрузка данных для соревнования {contest_id}...")

    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        if data['status'] != 'OK':
            print(f"Ошибка: {data.get('comment', 'Неизвестная ошибка')}")
            return None
        print("Данные загружены успешно!")
        return data['result']
    except Exception as e:
        print(f"Ошибка: {e}")
        return None

def change_raw_result(raw):
    res = {
        "id": raw["contest"]["id"],
        "problems": [
            f"{problem['index']}. {problem['name']}"
            for problem in raw["problems"]],
        "ghost": [],
        "living": []
    }

    for actor in raw["rows"]:
        party = actor.get("party", {})
        if party.get("ghost"):
            res["ghost"].append([
                int(actor.get("points", 0)),
                actor.get("penalty")
            ])
        else:
            res["living"].append([
                int(actor.get("points", 0)),
                actor.get("penalty"),
                [x.get("handle", "") for x in party.get("members", [])],
            ])
    return res


def save_result(result, contest_id):
    filename = f"gyms/contest_{contest_id}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Результат сохранен в {filename}")


if __name__ == "__main__":
    contest_id = 106353
    result = download_standings(contest_id)
    if result:
        save_result(change_raw_result(result), contest_id)
        print("\nГотово!")
