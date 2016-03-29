// Copyright 2014 The go-ethereum Authors && Copyright 2015 shift Authors
// This file is part of the shift library.
//
// The shift library is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// The shift library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the shift library. If not, see <http://www.gnu.org/licenses/>.

package core

import (
	"compress/gzip"
	"encoding/base64"
	"io"
	"strings"
)

func NewDefaultGenesisReader() (io.Reader, error) {
	return gzip.NewReader(base64.NewDecoder(base64.StdEncoding, strings.NewReader(defaultGenesisBlock)))
}

const defaultGenesisBlock = "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"
