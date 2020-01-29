import sys
import xml.etree.ElementTree as ET
from optparse import OptionParser

import psycopg2
import json

from src.Commission import Commission
from src.Council import Council
from src.MEP import MEP

party_mapping = {
    'Identity and Democracy Group': 'ID',
    'Group of the European United Left - Nordic Green Left': 'GUE/NGL',
    'Group of the Greens/European Free Alliance': 'Greens/EFA',
    'European Conservatives and Reformists Group': 'ECR',
    'Group of the European People\'s Party (Christian Democrats)': 'EPP',
    'Renew Europe Group': 'Renew',
    'Group of the Progressive Alliance of Socialists and Democrats in the European Parliament': 'S&D',
    'Non-attached Members': 'NI'
}

committee_mapping = {
    'AFET': 'Foreign Affairs',
    'DEVE': 'Development',
    'INTA': 'International Trade',
    'BUDG': 'Budgets',
    'CONT': 'Budgetary Control',
    'ECON': 'Economic and Monetary Affairs',
    'EMPL': 'Employment and Social Affairs',
    'ENVI': 'Environment, Public Health and Food Safety',
    'ITRE': 'Industry, Research and Energy',
    'IMCO': 'Internal Market and Consumer Protection',
    'TRAN': 'Transport and Tourism',
    'REGI': 'Regional Development',
    'AGRI': 'Agriculture and Rural Development',
    'PECH': 'Fisheries',
    'CULT': 'Culture and Education',
    'JURI': 'Legal Affairs',
    'LIBE': 'Civil Liberties, Justice and Home Affairs',
    'AFCO': 'Constitutional Affairs',
    'FEMM': 'Women\'s Rights and Gender Equality',
    'PETI': 'Petitions'
}

db_schema = {
    'meps': "CREATE TABLE meps (id integer PRIMARY KEY, firstName varchar(127), lastName varchar(127), country varchar(127), politicalgroup varchar(127), nationalparty varchar(127), urlHomepage varchar(127), urlPhoto varchar(127), parliamentary_role varchar(127));",
    'committee': "CREATE TABLE committee (id SERIAL PRIMARY KEY, committee varchar(4), mep integer, label varchar(127), FOREIGN KEY (mep) REFERENCES meps(id));",
    'commission': "CREATE TABLE commission (lastname varchar(127) PRIMARY KEY, firstname varchar(127), portfolio varchar(127), homepage varchar(127), country varchar(127));",
    'roles': "CREATE TABLE roles (id SERIAL PRIMARY KEY, commissioner varchar(127), role varchar(127), label varchar(127), FOREIGN KEY (commissioner) REFERENCES commission(lastname));",
    'council': "CREATE TABLE council (lastname varchar(127) PRIMARY KEY, firstname varchar(127), country varchar(127), party varchar(127), dbpedia varchar(127));",
    'procedure': "CREATE TABLE procedure (id varchar(127) PRIMARY KEY, title varchar(127), status varchar(127));",
    'document': "CREATE TABLE document (id SERIAL PRIMARY KEY, procedure varchar(127), author varchar(127), status varchar(127), url varchar(256), data varchar(127), FOREIGN KEY (procedure) REFERENCES procedure(id));",
    'group_pres': "CREATE TABLE group_pres (mep integer PRIMARY KEY, label varchar(127), FOREIGN KEY (mep) REFERENCES meps(id));",
    'committee_pres': "CREATE TABLE committee_pres (mep integer PRIMARY KEY, label varchar(127), FOREIGN KEY (mep) REFERENCES meps(id));"
}


def drop_all():
    conn, cur = open_connection()
    for table in db_schema.keys():
        if existsTable(cur, table):
            cur.execute("DROP TABLE " + table + " CASCADE;")

    conn.commit()


def existsTable(cur, tableName):
    cur.execute("select exists(select * from information_schema.tables where table_name=%s)", (tableName,))
    return cur.fetchone()[0]


def getConnectionCursor():
    # Connect to an existing database
    conn = psycopg2.connect("dbname=" + options.database + " user=" + options.usr + " password=" + options.psw)
    # Open a cursor to perform database operations
    cur = conn.cursor()
    return conn, cur


def open_connection():
    pairConnCur = getConnectionCursor()
    conn = pairConnCur[0]
    cur = pairConnCur[1]
    return conn, cur


def createDB(schema):
    conn, cur = open_connection()

    # Execute a command: this creates a new table
    try:
        if not existsTable(cur, schema):
            cur.execute(db_schema[schema])
        else:
            print("tabella già creata")
    except psycopg2.errors.DuplicateTable as dupTab:
        print("ERRORE in createD")
        print(dupTab)
    return conn, cur


def load_mep(connectionDB, cursorDB, path):
    tree = ET.parse(path)
    root = tree.getroot()

    for mepRead in root:
        mep = MEP(party_mapping)
        mep.setFullName(mepRead[0].text)
        mep.setCountry(mepRead[1].text)
        mep.setPoliticalgroup(mepRead[2].text)
        mep.setId(int(mepRead[3].text))
        if len(mepRead) > 4:
            mep.setNationalpoliticalgroup(mepRead[4].text)
        else:
            mep.setNationalpoliticalgroup("")

        what_to_insert = mep.toTupla()
        cursorDB.execute(
            "INSERT INTO MEPs (id, firstName, lastName, country, politicalgroup, nationalparty, urlHomepage, urlPhoto, parliamentary_role) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);",
            what_to_insert)
    connectionDB.commit()


def load_committee(connectionDB, cursorDB, path):
    for key in committee_mapping.keys():
        tree = ET.parse(path + '/' + key + '.xml')
        root = tree.getroot()
        for mepRead in root:
            mep_id = int(mepRead[3].text)
            cursorDB.execute("INSERT INTO committee (committee, mep, label) VALUES (%s, %s, %s);",
                             (key, mep_id, committee_mapping[key]))

    connectionDB.commit()


def load_commission(connectionDB, cursorDB, path):
    with open(path + '/commission.json', encoding='utf-8') as json_file:
        commission = json.load(json_file)
        members = commission['commission']
        for member in members:
            commissioner = Commission()
            commissioner.firstName = member['firstname']
            commissioner.lastName = member['lastname']
            commissioner.portfolio = member['portfolio']
            commissioner.country = member['country']
            commissioner.setUrlHomepage()

            cursorDB.execute(
                "INSERT INTO commission (firstname, lastname, portfolio, homepage, country) VALUES (%s, %s, %s, %s, %s);",
                commissioner.toTupla())

        connectionDB.commit()


def load_roles(connectionDB, cursorDB, path):
    with open(path + '/commission.json', encoding='utf-8') as json_file:
        commission = json.load(json_file)
        members = commission['commission']
        for member in members:
            roles = member['roles']
            comm = member['lastname']
            for r in roles:
                cursorDB.execute(
                    "INSERT INTO roles (commissioner, role, label) VALUES (%s, %s, %s);",
                    (comm, r[0], r[1]))

        connectionDB.commit()


def load_council(connectionDB, cursorDB, path):
    with open(path + '/council.json', encoding='utf-8') as json_file:
        council = json.load(json_file)
        members = council['council']
        for member in members:
            pm = Council()
            pm.firstName = member['firstname']
            pm.lastName = member['lastname']
            pm.country = member['country']
            pm.party = member['nationalparty'] if member['nationalparty'] != '' else None
            pm.dbpedia = member['dbpedia'] if member['dbpedia'] != '' else None
            cursorDB.execute(
                "INSERT INTO council (firstname, lastname, country, party, dbpedia) VALUES (%s, %s, %s, %s, %s);",
                pm.toTupla())

        connectionDB.commit()


def load_procedure(connectionDB, cursorDB, path):
    with open(path + '/documents.json', encoding='utf-8') as json_file:
        doc = json.load(json_file)
        procedures = doc['procedures']
        for proc in procedures:
            id = proc['id']
            title = proc['title']
            status = proc['status']
            cursorDB.execute(
                "INSERT INTO procedure (id, title, status) VALUES (%s, %s, %s);",
                (id, title, status))

        connectionDB.commit()


def load_document(connectionDB, cursorDB, path):
    with open(path + '/documents.json', encoding='utf-8') as json_file:
        doc = json.load(json_file)
        procedures = doc['procedures']
        for proc in procedures:
            id = proc['id']
            documents = proc['documents']
            for doc in documents:
                author = doc['author']
                status = doc['status']
                url = doc['url']
                data = doc['data']

                cursorDB.execute(
                    "INSERT INTO document (procedure, author, status, url, data) VALUES (%s, %s, %s, %s, %s);",
                    (id, author, status, url, data))

        connectionDB.commit()


def load_subroles(connectionDB, cursorDB, path):
    with open(path + '/subroles.json', encoding='utf-8') as json_file:
        doc = json.load(json_file)
        subroles = doc['subroles']['parliament']
        for role in subroles:
            id = role[0]
            label = role[1]
            cursorDB.execute(
                "UPDATE meps SET parliamentary_role = '" + label + "' WHERE id = '" + id + "';")

        connectionDB.commit()


def load_group_pres(connectionDB, cursorDB, path):
    with open(path + '/subroles.json', encoding='utf-8') as json_file:
        doc = json.load(json_file)
        subroles = doc['subroles']['group-presidency']
        for role in subroles:
            mep = role[0]
            group = role[1]
            cursorDB.execute(
                "INSERT INTO group_pres (mep, label) VALUES (%s, %s);",
                (mep, group))

        connectionDB.commit()


def load_committee_pres(connectionDB, cursorDB, path):
    with open(path + '/subroles.json', encoding='utf-8') as json_file:
        doc = json.load(json_file)
        subroles = doc['subroles']['committee-presidency']
        for role in subroles:
            mep = role[0]
            group = role[1]
            cursorDB.execute(
                "INSERT INTO committee_pres (mep, label) VALUES (%s, %s);",
                (mep, group))

        connectionDB.commit()


def main():
    global options

    drop_all()

    # MEPs
    conn, cur = createDB('meps')
    load_mep(conn, cur, options.input + '/mep.xml')
    cur.close()
    conn.close()

    # committee
    conn, cur = createDB('committee')
    load_committee(conn, cur, options.input)
    cur.close()
    conn.close()

    # commission
    conn, cur = createDB('commission')
    load_commission(conn, cur, options.input)
    cur.close()
    conn.close()

    # roles
    conn, cur = createDB('roles')
    load_roles(conn, cur, options.input)
    cur.close()
    conn.close()

    # council
    conn, cur = createDB('council')
    load_council(conn, cur, options.input)
    cur.close()
    conn.close()

    # procedures
    conn, cur = createDB('procedure')
    load_procedure(conn, cur, options.input)
    cur.close()
    conn.close()

    # documents
    conn, cur = createDB('document')
    load_document(conn, cur, options.input)
    cur.close()
    conn.close()

    # subroles
    conn, cur = open_connection()
    load_subroles(conn, cur, options.input)
    cur.close()
    conn.close()

    # group presidency
    conn, cur = createDB('group_pres')
    load_group_pres(conn, cur, options.input)
    cur.close()
    conn.close()

    # committee presidency
    conn, cur = createDB('committee_pres')
    load_committee_pres(conn, cur, options.input)
    cur.close()
    conn.close()


if __name__ == "__main__":
    print("XML loader")

    argv = sys.argv[1:]
    parser = OptionParser()

    parser.add_option("-i", "--input", help='input folder', action="store", type="string", dest="input",
                      default="../data")

    parser.add_option("-d", "--database", help='database url', action="store", type="string", dest="database",
                      default="modsem")

    parser.add_option("-u", "--user", help='database user', action="store", type="string", dest="usr",
                      default="postgres")

    parser.add_option("-p", "--password", help='database password', action="store", type="string", dest="psw",
                      default="demo")

    (options, args) = parser.parse_args()

    if options.input is None or options.database is None:
        print("Missing mandatory parameters")
        sys.exit(2)

    main()
