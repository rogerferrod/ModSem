class Commission(object):
    BASE_URL = "https://ec.europa.eu/commission/commissioners/2019-2024/"

    def __init__(self):
        self.firstName = ""
        self.lastName = ""
        self.country = ""
        self.urlHomepage = ""
        self.portfolio = ""

    def setUrlHomepage(self):
        if self.portfolio == 'President of the Commission':
            self.urlHomepage = Commission.BASE_URL + 'president_en'
        else:
            self.urlHomepage = Commission.BASE_URL + self.lastName.lower() + '_en'

    def toTupla(self):
        return (self.firstName, self.lastName, self.portfolio, self.urlHomepage, self.country)
