class Council(object):
    def __init__(self):
        self.firstName = ""
        self.lastName = ""
        self.country = ""
        self.party = None
        self.dbpedia = None

    def toTupla(self):
        return (self.firstName, self.lastName, self.country, self.party, self.dbpedia)
