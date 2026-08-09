/* ============================================================================
   Fifty Overs :: LEAGUE sync. Your game IS the multiplayer game. This module is
   a thin login gate + sync layer, not a parallel UI: after you log in it hands
   the screen to the real game and keeps it in step with the server. The shared
   league lives as one game snapshot() per league; each manager drafts in the
   game's own founder screen and pushes their club, sets orders in the game's own
   Orders screen (pushed as a packet), and the background resolver replays the
   packets through the engine and publishes the next snapshot. The game's own
   table, fixtures and match screens do the rest. Deterministic engine untouched.
   ========================================================================== */
(function () {
  "use strict";
  var URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var BUILD_HASH = "e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff";
  // The real Fifty Overs app icon you designed (downscaled + embedded).
  var APPICON = "data:image/webp;base64,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";
  var FAVICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAQAElEQVR4AaRbB3xW1fl+zv2SkAFJSEJAAeuuoijDgYqiaG1V3Hu0bkEr4MQBAooIDiooQhVcVFGxgqgo9idY67ZucCACgjIFgYRAyPju/3nec+83Yijt739y3vPucc49d34Q1G+pCuu3bAxX/LQ0vHLArWHLyn3DgopOYWFTaEOZIFMuvs0+YWEM1MlXkPKXDeWFMa6gvfgYYt//F2ZtcbwmuHLnA8LxEx8LN6xdbfP08/Vz1rwDIMTXC5bgqutG4ImpL6IxmYQDmw3E6k5MBClaCkHIQUDUXI9UYYSVL2WmkClme8R/MqZOdQmahNm0aTNuHjYGw0dPwMrVa6lVIQKS7MHP6zZg2F3jMeetD8jCTx6ZjcEzWdESxckUS8CFTKlEECQWkEx18SFthVPC/5pQ4u0Yq64sAJJc/SnPzsTYCU+hZnNtVoBg5L2P4PU576KhoTF78qkKU0TakQEhkEecTHTaglNMM3GEGCOyVYjQD/Dx4FuGLKVnREfwBv9hTPkqJDOyy622tg6PPPk8pr88JyOVQ/DkMy/CWtPF1cRMEQ0KZGSKUAaTNB3SFqIEmRbiBWlZiouLp8rvEq+JR+GmZdI0u6tugWathRYtoFWysRG33TkOX361kJzvQWNj0lMyJqUkApIWIjR5KJYTJopIUqYXzoS0Ok2lHTNlsZdk6el6LtYJRxIhZjQk8XbBIZp3luX6DVUY8+Dj2FK7lfIQARxxylIM+ag758Du67fkKjRSEjkCxRp/BQ7+L1a4mCB2zlGLCDwNNkeIu3OO+jSY3GZvg7E2kM3YOL5WyuhMdYa/I+uF+ODjL/H5vO/IOS6AjBE1F4J54fhn514kBoVhRLsIpxE1TSo4uG0u+u1fjCu7FKPffq1w0q5FZp4bOJyxRxGupO4q6fZvhc4VuVxDh4qCAJd1boWrupSgH+WX7dvKZOYYD79OTg3zM4JmrjIgG0EsI/aHjUJ20GDtL+vx9nsfo76hgQtgQkRNDIE9EmQhL/ajKTJI8T4RUFmUi86tA+xXnotu7QrQvtAX6bjAu5TmYf/yHOzfJg9dCKUtArqGaJGTg/0q89GZuq7E+9I3LyEd1Vk9O6kip9XZXFoeUZFaF/yvvv2ed4QtXACuiNQWNjIwnkddOAZndo5sZGR68uwUZvV/La9Fh5J87Ny6EB24GK8u3cLjANQ3Au+t3IoOxflo3zIXBZz0u7SV84rqrVi4dgt2KmmBncqLsGZLgOWb6ukX5ZOR1WAEB8kFjvT/3pcuWwE9I3BTAvFckBErg0S6KWHE2X4jnSEix+543wVycxJwYSNyeNRDkGbwkNpGXolzAiCHRzdAkrYhNdrAgHMJ5EpOm8AlATj7g5qKDEkYcGDn6lAPguyIZYO4uZhIY+kpds7hl/UbUbu1DoHF4aD52Hkf02m3iPIbnOqIJ5ITUXaXBUFPlGEStsKRAXPDOceFCeGkdwE1jgA4/TkAktNPJOL49KEm6mGEhWjFLspA9gKtjAm2NYSo2bKFOzIJVZBlFU/T4mRpmjCZiZuolN8WM5ZnBkuG0MRsTqK5Q9JmSS4DDCCdp5BqypkCEuymE7aAxv1Xg54JQi72rxYAltTZqIkYgI0JnHMiTOTnRF4yIjk4DgIawTknpLmCjPcBG8XOcRBp2T1NFo5/WjgBzIaL5aQRkBaCBAJjsgf5CLKlGRxjsKsYXz+QuUOj0CFxCA5ormXHp52MhASkDTkeZAYICch2AFVwyh7Khg7sJFmTacjB24gFm5REcZdYEPPN421YMBY7c9HLTBxSx8B4ZLbItKmCxUsk8Nay85NJUbQR7TgVJyMxwgaShNSE0DbnaFKorOjcl4XfOpHKkElpJSww4X85eHvl8g6O+R3J0C8AyIYGVgaTgE0GRJyMitG2FFAC6KjGECKjiXH0dwwcwlPEskXUGDaMyaz9x9zUSSW93uBS+RhRcg+6StGCPS2OHL0BA8VEjGUMOOcMwCZJCMc6oRZyEBCxO8L2u+wFmZbyDBkWBNGsJURW04UH1KKZFvCuYOtNnXMOzjlS7E1iUNJMj2wzNfKLIUMuSwMO/jYYKcnD8Q8GAFSAAUkADmwa4ioVnCJ1iYVjCCOB4YjmcthBk1uouHGcyCl9xMFcchKAzZGHAeLmSBCcSS0iBVF3Ec5AXhTb+V0kLroGOIZxkTnFJNlVrwdqI+WvEK1Tk/JKB5sbb2PSOecYQ5S0jjonAiH1SaPiQTYhHE8LFaUS4U1pYJzlIWNiF40MDucoDQlZnUIpDGRFZUgZ7UJ4rIsx05GhrmkPUwJSPFIcrQCSKc22CNnGOh3VTD4ljwjVF5GAMSGvjaHlci6jtozEiuctolGCDFNEzdybkUdqyxFABgJJ5SEQLch4SDFrJZI8gjQrSuAV9Ty0ry/djNeW1GDWok2oruNLgFdh9eYGvLpkM6EGby6tQXpeDvPW1ePVxZvoU42PV0rHmHFtkb+QFtXqEbMN0IvXdu0YPjB/EoabDplyFUJgZ26tvJQx0FEkNdpstQ1JjPtsI+4njP28Cuu3Usku9eKNjRhL+TjKH/2mBnYA4NscLsj9n26EdK8tq/NC+YmKD4zxur8wk9FSNgMpXYpAnEtzMJqEXwBVZgDfdFgEnos0ChSirKwElW3KCWWorBCQriC0EU0gbhvphdPgdZXSV1agkjbSCVdKJqgsR9sYGLustBgBT1JljkqBCmfdQojXBGwZ5ZLj4tjYzJByUhTEt8FmDClSYoEjra43vNHDr8Pkcbdh8gPDMelBwgNDSQ/DJPEEySc/MMxkHg83WraTaW/6B6WXXJCmFUN64UkPDsXN116OkpJipeaMWAm7MSpIYIwf4nk1EXtl1hgFiZDfAbF3dKyz7MlEtjxqZeh1SGcc1fNAQnf07tkNvQ8/AEcdTtqAdM8DcGQWdDf+qJ7d4YH6wzx9pMkOoPyAyEbY645iji6dd+NrtS+RZbCzEnauBunmu6kjla4BgohtFjG6XATUC2XspczVFH1kz4NRUuyPSN3WelRVbSbUoLq6xnBV9SYYVG1CNaHKoBpVVYJNxLITJsjW9KIpT/E12FhVg6XLluO773/k53peUbMODItkZ7VRFxNDJIqQcw7681da2cQKgCo44NengMwEMHU80jCRQOdOuyE/vwXLcXjlH++i/6DR6H/TaFwdYeMH3W18SnYTeUJ/A9oSXy2fG0ebr/cZhf7mN4q+BOouunoERo55GO3atsHvex+KU088BiefcBR6H3EAdtlpR+Tl5nIjsFIdMCKkmhhBSkDCRUAUzUuXcXHcAUIE2URKcmhKtioqRPt25Qi4dFv5JeWt9z/D9Flv8oeGuZj+SgzkSc+YNRczpHtF/JuYIVkWLT1BMtrG/jPE84eLjz+bhxOPOwLTnrgfM6eOxaO8zjx0z02YeN8tePKhEXhtxiTKH0Dfi05Hizx+bWJNPCp+QaBmkxEBm0cGCzWtD4EdAfR0FFvR0DkH55zMDGSk1erYoR26dulsujVrfsb7H37CncXtmTL1hEbnAjjnCIADCBzZETVnEhdxHgVkO3TYAbcNuhL/evVxXN/vXHTddze0bVOKkpJWaNWygFCI0tIS7FhZip4H74N77xiIz96ZiUv+eBpa847BFbDOwnzQjNE5JmDeDJHZBk1lWQbGaAmAju3bosMOlZQ4rF63EQu//4F0uiu8OG/NMd6aUgioVA2CzJyOTG5uDo7tfQiP7h24ccCfoNsrxaivb8CKlT/zO/58vPHWvzH37U/w6ZffYB0/a/NJGnA5rKkMdw25CmNH3Yh9O/0W22oqx2acacBigkw+m+YkUoIA++y1GxJ6dXLANwt5cUod/Ey7yCFLRAfNJlIhiwYCfgQ9+fij8ZeRg3BQt05IOKCRs3v7w3m44toROOn86/CnfkNw+cDbcdmA4Tjv0kE48ZwBuHXEBCz6YTmQbERBQQuccsLReGLinTiw2z7wzRfhaY1NeS/LXgDZGIS2i0SCBSf4SKwinXPM14gpU2egRYtcFHNrlrUuRnnrEhS3KrRC9OACNU6ErqR8FHgGQMRLT67bfr/FyCFXYyfusJDxFy35Ef2uuxPHn3kVnp/5BhYt/oE/Y9Vh7br1+HntOqzgT9w/rVyHhyY/gx5Hn417x0/Bxupa6NF3z112wN3Dr8Eeu/2GaZjHH3ZQiaym3AIKA0JWp1tcYkpeVlaMvfdkUF4y6vigv3PHthg6qC8eGz8Cf3/iL3ju0VGkb2fya3HRuSdhrz12geOfVlE1NHsvZqLf8Go+dvTN2LFtGXOG+PCTr3nUR+LZ6bPpSgNW0LF9O9x9+3WknEF+fj5GDx9oO6WWt+JRY5/AwJtH2W3TuQDdu3TCdVddgEQiQfuoswh5R1wW4kWQiWjACiIFeVLeQXSIQw/ujry8HEqThsfcNQj9Lz8Hvz/qIBzYtRMOPmB/nsOH4qLz+mD0sAF46pG7cOu1l6K4uCV94q5YMQ3GycWNAy5C5713Az8S4pPPOfmBw/HRJ/Nt8sovqNlUgx7d9+aEeKy4Q+rr67Hrzh1RUV5GvwAN5GfOmoMbh41DXYODdsIZJx+NE449AtY0NyOcjelBvOMhRdxYIGXsEJAzBXPisgvPhHMJ4wOeDiWtiqBflbfW1nJ7bkVtXT3qCRTyNMjHnrt35GPsRVyI0dh5p/b0C21StsgKzKIO6r4v7++HwDnHrb0Rt9w+Dj8sXU5bwPFPXVT1lq1oQC6v8iUWQz9r/bh8NZ8PKmybK1xDY4jZc97HnfeMRyN/78tvkYcJ9w/jaVlkKWFNlkbY4DhqsbisogQSEUfdcw4tC4vQqqgFFi/9CUt+XI153yzC1Bdm4457J+Hya0birEtuxrmX3YyBt47BhMdewBfzv0OdFoPbsRcfeceMuAbt2rSOorJmlpSXl4ujjzgIFbx+6II387W38eXXi6hJmXmCReiZ44oBt2EjnyblLRg68gF8v3gZwMVz4B9xyF+h/vrYNHz8xXeME6C4MBd9ft+LWtAlpIz4V91FO0CLw6MCNcfBwIFxsZWT6T9oFC7sNwQXXjkEF199Owbyae7+h56EHnbeeuffmPPPD/HUcy/j1jsfxKVXD8PkKTPR0Ajwkoljeh2Ee+64gTujAKyEAHujPKxHNyRyEqiursLLs/+Jms2bTUcnQInhoBbyS/GuvFYcdQR3S1Rux/aVOKxHF6ppw07Cei1/fHzmhddRz9NCguOOPRz53A2itwUBlExBBGYlwsEZDdQx2Lyvv8dn8xbgM96DFyxcDB0VxyPsJ+RXV2uY5O3ru0XLcMsdD+D20RPRSN8EL0annXgMTj2hN7dw0qKWtW6N3+6+Exz/li1fg/c+/JRycUSUaUyDQ/sd2qBr5z15FJUr4PavRKe996Ils7KDlGM9+sw2/+tvsXLVGrjAYcd25Sjn6zv+Qwu8zhEJGE07gRASKISj2AMJxCANyHnej7DGGd6ldwAAC5FJREFUCDbRsROewNTpb6AhSW3YgIvPPZ4XrtZwLrBn+WJeRzSdDz7+CrX2rzXorkTKKyBrnfTKlSvsKdBBf+CvutVw3PLSWz4RBiG+XbgU3y9ZzmMTok15a+y4Q1vTNB3Mj0O0ALHacZUFaR5M6gHppkJjTrQBYMgBEAQJPP7My/hp+SpoMXfdZSd046N0yC29045tkODOAOl587+lvTMXWHMcBUQskDPB8lXrsWbtetYmLuQzwQas/WWD8WbJRQoJ9OApVc0nxV9EorS0VcYOUDCBqVJDkwVIyWEVWdAMJ5EGGlQMwWzAxoUzsZVk/PyvvsGHH3F7U1RRUcGnyV3BnYmKNmXUJzkBx4ltYCpHPuoiBRELaj/45Cs8/PjzpJQgxDxeMJ/lhVg6NGlh6FDX6GvJ5VNmAZ8bmpikWKXJWAAfnK5MFE+MMnZydCIhDwE5dZEChNzMBOeMo0o45Nauw+Jlq5DkaRDw9/52bUqQm5uHhgbGkpVLkM8htY3uvLy8dSvssfsuxkikl6PfdNzR6pTQORfRDiICnR6UhVyMJB+VJYM16n1q41g1uABZEh4VTTdDJkkGyxB09iOJqDs45yLao1A+lK1Zu4HP9rwlkC8pLYWu/CtXrqYRUyOJDnoENmOKmuuM0fPg/XHBWcepEoDXED08nfiHw6FK4YiizhT8TpCDosJ8ikN7RqnapLuLo4UgRp52tFIVlGb2kGLw/l/IQAX8AJJHZWi5SPjuiJyGCEckOXba+lK5MbQLasEtAAVNcP/rx4gly1ZyFyQpcji4276IQyGrMQ47eJ1oU16MzXwgApiIi1Vc3IoZEoB4qMnQ40qeXjvs4C98en9YuepngD7SZgIjQe5cACMBcQBHZ+/fy76ZixUL5uLL92agVSslhAWKU5EDjU3GamCNidijfKGpW7JYl+A2p2Irr/YhDZfzFXfVmrWkQnTbfy/e1tqQZqcNR3ZZEVl30PVjxYpVxoE7IIevjFUbeVGUvUwF1GomnfbcFbvtrKdPYPXP6+HzUJnVtfkpoB8XgESTvrlmC1av/pnnRxKl/AZYWlzoJ5qyo6dmzXPMUxqpVAVEmV1PgT6Jwy8balDPJ6S169bh8y+/VQTeqkpxdK8ecK6JM0P6Mh1em/sR/sGHLa1syHP6ky8WYO47vLhmJmK0nJwcHHZIN5TyLRVw+OrbxfwOuQksnpDdLRsHXxudM41U5Otz3wO42vl5AS4+/zQ40rDGykBPAxP4QUfDUzY66kv4MrTnrh0QMMvW+kb88OMKbv0GbORH1Hc+/BzaEYWFBTi1T2+04e8E5qg4SmGMQ5AIcDLf9deu3QCGhOrs2aM7amo0MXFaJgHQsiAX5595AgKeanwmw9S/vwq9s8A7IrMphVKxNImdBpid8/SUp6ebs3OOn5xOhSZjaeSpBZM3sawFsVi0HSnquvK+3+Ogrozr+GVnlT1Jmo7Vvf7GO1j602qmdPZpvc8f9PamKAIAzMuOooI8nNGnF79DNJgswcmdf1YfFBZwV1oysIUoKirEjGcnorK8hLzDnLc/xvyvv4PiCFKmrAts4tMvQxQAJoI1kvMXLMFHn8438zLehoZcfymTFpjahJ7a5pjg0l5y3kmoKCtlZMeXpIVYsHAJ7RmcARbxzW/i4y+gobEBuTkJDL3hcpx+0jFIJHJpw24LDLTfcQc7dbbUbubTX4h8vpzpKr9q9WoasXO9KvjEN/ymvui+Hx+PuWo/LFth//9BIcjSSN2xDo81xsD1jMlsrNfbx56eiS386OB4JT7njONx7hnHIRFwZtmmKY61cGpADj9ZP3TvYPQ59hBL2hgGGD/5Ofh/oEzzqKqnnnsJTz/Pjx8U6V7/l1E34+orzkWLPF40LZKzfFOmTgfo43dgEtNmzEbtVu4IgK+8BRg1dCAuPOckODRC9d4/4WnYf46gDygFW1wbyXSnUF/50oIU5YyaNfstvPr6myzFoZTn8323X8Ovtn1RWJjH8ywAMhI4Lrf+8aM+nD71yGhccHYfW4iGhjrccc9E+9BBB+tgozknUY/bRj6If8z9AEleUMuKCzF80CWY8vBIVFZW8k2uBb5esAiT/vYiWAS9HN8aazHx0WdQyC1/6IFd8OX7L+OcU3/H3ZnP5w2Hp6fNwtN/nwU/A7qkOmebokXQgvVzFmKoVEUiY6C+mg8RI+97FP96/3Oeuknk8uvttVeeh/dmT8GNAy7G6Sf/Dsf97jD0Oe5I0sfg1usuxZyXJuP4Yw5mwSEn2IC/8QhPfPS5OCoxA2skYsf6jVUYMvIheyXWU1tOTi5jHoF57z6PR8YO5gXyaOQkdM8HscPxx/ZC/yvOwyvPjMOsaeNRUVoA5wJs4kVR7x5DRo6HfrUCg7MLGSCzcboB935gC9B04ilDuQOL+OX1quvuxDPTX+cKhwiCALvu0pGfvC7GX++7GZPGDcUj99+Gh8cOxQ39/4T2fAVV4CTjTnxsGkbeNxlb7CEmFZiEj02C3eHb7xbhhtvGYPjdk7C+agsXL4nC/BycckJvjLnzerStKIZzDj0O7IIHR92AEYOvti/IOTmOBwZYwFfw64eOxU1D7+Pdgf4WNTMHBU16QUE+cnIC3upNQWMmMDIaKAE46Lxbtnwl9FHk+sH3oXpLgxUYUJeflwd9HmtZ1IKPoAk457hTQyzlO/6RfS7D0LsmYBWfJ7jgUHPwf6JBGrSnAwDHc3Yd7p8wBb1PvARz+BtA6BIU8yGorBjDB1/DR+gAp53YG3rSC/hZDvTV//V4eMqLOPqkyzF12qv8dsFHbsqlA1sI1SMgk+ohKEY5L5z5eS24AI7z4dGKXycRNZqRopKjel1dAx7lRbFzj5P42Xokpr00B3Pf/QzvfEDgz2Rz3voIz704F+ddPhg9jvkjPv3iG7kBLCiOosUUoNmmQh2+X/wjzrzoBnTvdTbuuPth6HNZUVERduavRnkseC5vb8+/9Cb+POhu7H3QKbhhyH32XKE8FlaFE9iN5ewiTMR5+gWHfYYvKtQCpC1p0VxX+QR27bd1v2zgRWY2+l4zAhdccQvOv2IwMaHvYPS79naey2+hml9y40hySxUXC7eDG/hhU1+Wxoyfgkv6D2euYVi+ci131EO4oO+tuGLgMDw59SXumrXbiZQxOZLsNn9dUzrttTuKWhZyBzCEihSQZI/NSGZ1bxHC43oWqZ/C163fyPt0lZ17DXzMTbnER544JWuOUDiCzJyLCcA57Qh+kqvbyo8cm3hBrcP69VW82G1GQ0MScXOOPjEjLFYgOgvCiAtRxo+xhx3UBbk5Ofrn8iFXxYNZ8HYUEkRnnRahD+Bj+1E2BipC4Bkr3jnaCEz260HhFF+YBdCA9hx9b0qTVywBPO2cg3POmzcdfaleStpykJO1oOt+ndC96z4mCRJB4E8TGvpCKG+2y9UrlFecwCSWIYR46Uy23SFsYtGUb6LeJqus21TCiuLEdIg10eJWRbi+/0Uo4jsI2IKzT/0DUdxVROh9KHIxFRoDpGZHgWiCQ9QoiqjtIvkIZGjYBnH/C8hJIB/hGMiLJIp7zDrncOv1/fhrlo4+IHkw7JY/o9dhByCR4G0HcYtmIwuJdNvRURbEMq6qVGBQA2OaH1Iukdqi0885atgjMQ+QNIKUJCK2JZO8KcQulKteAUV5fDw//6wTcd5Zx7NcJdWeCBGU84Iw9KYr0bNHV0DyGLCNxriIDaPgiJt8bWHMyE+INkpFhp1y8rqbkKGXeI/MzQ8WnVJ26QUkTUda5PaAOWQZg9b5lBOOwrVXXsAHrBbQE2cyyapoEDTwar7XHr/B3XzOP50/YCScvyb4udDCEitjTMc4SSFpJgNfltITimTmR1o4ZRP5pGSRXryBQqqwyE5+JqedaIK/N5CP5FZnRFsNtGGUVM/Pz8OAvudh8A190a5tOe8gDYRGvl43Qhfh/wMAAP//aR08DwAAAAZJREFUAwD+yC8Hwx9gzAAAAABJRU5ErkJggg==";

  var JWT = "", LG = null, SYNC = null;
  // ---- THE EDGE PAYS THE EGRESS --------------------------------------------
  // Nineteen players burned 19GB of Supabase's 5GB free month, because every
  // tab pulled the same snapshots straight from the origin. The site's own
  // Cloudflare worker (edge/worker.mjs) now caches anonymous reads at /sb/*,
  // so this wrapper points every module's public GET there in one place: an
  // anonymous read is answered by the edge; a request carrying a manager's
  // own Authorization token, and every write, still goes straight to Supabase.
  // If the proxy is absent (local dev, an old worker), the 404/405 falls back
  // to the direct read, so nothing is ever worse than before.
  (function () {
    try {
      if (location.protocol !== "http:" && location.protocol !== "https:") return;
      var PREFIX = URL + "/rest/v1/";
      var direct = window.fetch.bind(window);
      var hasAuth = function (input, init) {
        var h = (init && init.headers) || (input && typeof input === "object" && input.headers) || null;
        if (!h) return false;
        if (typeof h.get === "function") return !!h.get("authorization");
        for (var k in h) if (String(k).toLowerCase() === "authorization") return true;
        return false;
      };
      window.fetch = function (input, init) {
        try {
          var u = typeof input === "string" ? input : (input && input.url) || "";
          var m = String((init && init.method) || (input && typeof input === "object" && input.method) || "GET").toUpperCase();
          if (u.indexOf(PREFIX) === 0 && m === "GET" && !hasAuth(input, init)) {
            var prox = "/sb/rest/v1/" + u.slice(PREFIX.length);
            var pin = typeof input === "string" ? prox : new Request(prox, input);
            // no-store: the worker used to answer with max-age=86400, so the
            // BROWSER cached the world's snapshots for a day - a manager could
            // reload all he liked and still be shown the morning's league.
            // The edge cache is the cache; the browser must always ask it.
            var i2 = Object.assign({}, init || {}, { cache: "no-store" });
            return direct(pin, i2).then(function (r) {
              return (r && (r.status === 404 || r.status === 405)) ? direct(input, init) : r;
            }, function () { return direct(input, init); });
          }
        } catch (eW) {}
        return direct(input, init);
      };
    } catch (eF) {}
  })();
  // post-render hook registry: core renderMatch calls foAfterMatchRender at
  // the end of every render; league features register here (one closure)
  var foMatchRenderHooks = [];
  window.foAfterMatchRender = function () {
    for (var i = 0; i < foMatchRenderHooks.length; i++) { try { foMatchRenderHooks[i](); } catch (e) {} }
  };
  // Art lives in client/art/. From index.html at the repo root that's "client/art/";
  // from client/game.html the page itself sits inside client/, so it's just "art/".
  var FO_ART = (location.pathname.indexOf("/client/") !== -1) ? "art/" : (location.pathname.indexOf("/next/") !== -1 ? "../client/art/" : "client/art/");
  // the game's own nationality list; each manager picks one as their home country
  var NAT = ["Australia", "India", "Pakistan", "Sri Lanka", "New Zealand", "South Africa", "England", "Netherlands", "West Indies", "Afghanistan", "Ireland", "Zimbabwe"];

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // Branded toast notifications instead of native alert() popups. Errors show
  // terracotta with a warning icon; everything else neutral navy with a check.
  var _toastHost = null;
  /* TOASTS ARE GONE.
   *
   * Every confirmation this program had was a slab that slid over the corner
   * of the screen, sat there for up to six and a half seconds and then took
   * itself away - on a phone, over the thing you had just tapped. Sixty-nine
   * call sites, most of them telling you what you had plainly just done.
   *
   * The work still reports itself where the work is: an order that saved
   * leaves the room, a bid that lands appears on the board, a lineup that
   * files turns its button green. What is left here writes to the console so
   * nothing is lost to somebody debugging, and puts nothing on the screen.
   * Errors that a manager genuinely cannot proceed past still stop him - those
   * go through foConfirm, which is a modal and stays. */
  function toast(msg, kind) {
    try { (kind === "error" ? console.warn : console.info)("[fifty-overs] " + msg); } catch (e) {}
  }
  function say(m) {
    var isErr = !!(m && (m instanceof Error || m.message));
    toast((m && m.message || m).toString().slice(0, 320), isErr ? "error" : "info");
  }
  // Busy state for the auth CTAs while a request is in flight.
  function busyBtn(act, label) { var b = wrap.querySelector('[data-act="' + act + '"]'); if (b && !b.disabled) { b.setAttribute("data-t", b.textContent); b.textContent = label; b.disabled = true; } }
  function unbusyBtn(act) { var b = wrap.querySelector('[data-act="' + act + '"]'); if (b) { b.textContent = b.getAttribute("data-t") || b.textContent; b.disabled = false; } }
  // Branded confirmation modal replacing native confirm(). Destructive actions get
  // deliberate friction: danger styling, explicit verb on the button, and the SAFE
  // choice holds focus so Enter/Escape can never destroy anything by accident.
  /* ---- THE DECISION HAPPENS WHERE THE DECISION IS ------------------------
   *
   * A native confirm() is the browser's dialog, not the game's: it prints the
   * hostname, it stacks a "Suppress dialogs" button under the question, and on
   * a phone it covers the page you were reading to ask about it. A branded
   * modal is better looking and exactly as rude - it still takes the screen
   * away from the thing being decided.
   *
   * So a decision is taken in place. The button that was pressed steps aside
   * and a strip opens where it stood, carrying the question, what it costs,
   * and the two ways out. Cancel puts the button back. Nothing covers anything
   * and the page never moves under the reader.
   *
   *   foDecide(btn, { q, note, ok, danger, onYes })
   *
   * The strip is keyboard-safe: Escape cancels, and the SAFE choice holds
   * focus, so no destructive action is ever one stray Enter away. */
  /* ---- ONE MENU, EVERYWHERE ----------------------------------------------
   *
   * A row of filled pills is a row of BUTTONS, and a button says "this does
   * something". A filter does not do something - it says which of the things
   * already on the page you are looking at. Six lozenges in three colours
   * across the top of a statement is a toolbar shouting over the thing it is
   * meant to be quietly filtering.
   *
   * The elegant form is the one the Stats Centre already uses and everything
   * else now shares: the choices set as plain type, close together, with the
   * live one carried in ink and underscored in rust. It reads as a line of
   * words - which is what it is - and the page underneath stays the loudest
   * thing on the screen.
   *
   * Any row of <button>s or <a>s marked .fo-seg picks this up; the current one
   * carries .on. Nothing else is needed.
   */
  function foSegCss() {
    if (document.getElementById("fo-seg-css")) return;
    var s = document.createElement("style"); s.id = "fo-seg-css";
    s.textContent = [
      /* A MENU MUST SURVIVE THE BOX IT IS DROPPED INTO. The first cut trusted
         its parent, and on the statement - whose shell lays its children out
         in a row - the whole menu was squeezed to twenty-six pixels wide and
         eight tall, so three buttons at forty-odd pixels each spilled straight
         down over the ledger beneath them. It claims a full line for itself
         now whether the parent is flex, grid or ordinary flow, refuses to be
         shrunk below its content, and each choice keeps its words on one line. */
      "html body #page .fo-seg{display:flex;flex-wrap:wrap;gap:0 22px;align-items:center;",
      "width:100%;flex:1 0 100%;grid-column:1/-1;min-width:0;height:auto;min-height:0;",
      "margin:16px 0 10px;padding:0 2px;border-bottom:1px solid rgba(20,28,40,.10)}",
      "html body #page .fo-seg > *{flex:0 0 auto;white-space:nowrap;width:auto;height:auto;",
      "position:relative;appearance:none;-webkit-appearance:none;",
      "background:transparent !important;border:0 !important;border-radius:0 !important;",
      "box-shadow:none !important;padding:9px 0 10px !important;margin:0 !important;min-height:0;",
      "font:600 12.5px/1 Inter,system-ui,sans-serif !important;letter-spacing:-.005em;",
      "text-transform:none !important;text-decoration:none !important;cursor:pointer;",
      "color:rgba(20,28,40,.45) !important;transition:color .12s ease}",
      "html body #page .fo-seg > *:hover{color:#141C28 !important}",
      "html body #page .fo-seg > *:focus-visible{outline:2px solid rgba(201,85,47,.5);outline-offset:2px}",
      "html body #page .fo-seg > .on{color:#0E2246 !important;font-weight:700 !important}",
      "html body #page .fo-seg > .on:after{content:'';position:absolute;left:0;right:0;bottom:-1px;",
      "height:2px;border-radius:1px;background:#C9571F}",
      // on a dark plate the same line reads in paper and gold
      "html body #page .fo-seg.dark{border-bottom-color:rgba(255,254,252,.14)}",
      "html body #page .fo-seg.dark > *{color:rgba(255,254,252,.55) !important}",
      "html body #page .fo-seg.dark > *:hover{color:#FFFEFC !important}",
      "html body #page .fo-seg.dark > .on{color:#FFFEFC !important}",
      "html body #page .fo-seg.dark > .on:after{background:#E8B96A}",
      "@media(max-width:430px){html body #page .fo-seg{gap:0 16px}",
      "html body #page .fo-seg > *{font-size:12px !important}}"
    ].join("");
    document.body.appendChild(s);
  }
  try {
    window.foSegCss = foSegCss;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", foSegCss);
    else foSegCss();
  } catch (eSg) {}

  function foDecCss() {
    if (document.getElementById("fo-dec-css")) return;
    var s = document.createElement("style"); s.id = "fo-dec-css";
    s.textContent = [
      ".fo-dec{display:block;margin:8px 0;padding:12px 14px;border-radius:12px;background:#FFFEFC;",
      "border:1px solid rgba(20,28,40,.16);border-left:3px solid #C9552F;",
      "font:400 13px/1.5 Inter,system-ui,sans-serif;color:#141C28;text-align:left}",
      ".fo-dec.dngr{border-left-color:#B3372B}",
      ".fo-dec b{display:block;font:600 13.5px/1.4 Inter,system-ui,sans-serif;color:#141C28}",
      ".fo-dec p{margin:4px 0 0;font:400 12px/1.5 Inter,system-ui,sans-serif;color:rgba(20,28,40,.62)}",
      ".fo-dec .fo-dec-in{display:block;width:100%;max-width:220px;margin-top:9px;min-height:40px;",
      "padding:0 12px;border-radius:9px;border:1px solid rgba(20,28,40,.24);background:#FFFEFC;",
      "font:600 15px/1 Inter,system-ui,sans-serif;color:#141C28;font-variant-numeric:tabular-nums}",
      ".fo-dec .fo-dec-in:focus{outline:none;border-color:#C9552F;box-shadow:0 0 0 3px rgba(201,85,47,.16)}",
      ".fo-dec .fo-dec-act{display:flex;gap:8px;margin-top:10px}",
      ".fo-dec button{flex:0 0 auto;min-height:38px;padding:0 16px;border-radius:9px;cursor:pointer;",
      "font:700 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      ".fo-dec .fo-dec-no{background:transparent;border:1px solid rgba(20,28,40,.24);color:rgba(20,28,40,.7)}",
      ".fo-dec .fo-dec-yes{background:#C9552F;border:1px solid #C9552F;color:#FFFEFC}",
      ".fo-dec.dngr .fo-dec-yes{background:#B3372B;border-color:#B3372B}",
      ".fo-dec .fo-dec-no:focus,.fo-dec .fo-dec-yes:focus{outline:2px solid rgba(201,85,47,.5);outline-offset:2px}"
    ].join("");
    document.body.appendChild(s);
  }
  function foDecide(el, opts) {
    try {
      if (!el || !el.parentNode) { if (opts && opts.onYes) opts.onYes(); return; }
      foDecCss();
      var o = opts || {};
      // pressing the same button twice must not open two strips
      var prev = el.parentNode.querySelector(".fo-dec[data-fo-dec='1']");
      if (prev && prev.__foFor === el) return;
      var box = document.createElement("div");
      box.className = "fo-dec" + (o.danger ? " dngr" : "");
      box.setAttribute("data-fo-dec", "1");
      box.__foFor = el;
      // a decision that needs a FIGURE carries its own field, so a reserve
      // price is typed on the board it belongs to rather than in the browser's
      // prompt box
      box.innerHTML = "<b></b>" + (o.note ? "<p></p>" : "") +
        (o.input ? "<input class='fo-dec-in' type='text' inputmode='numeric' autocomplete='off'>" : "") +
        "<div class='fo-dec-act'><button type='button' class='fo-dec-no'></button>" +
        "<button type='button' class='fo-dec-yes'></button></div>";
      box.querySelector("b").textContent = String(o.q || "Are you sure?");
      if (o.note) box.querySelector("p").textContent = String(o.note);
      if (o.input) {
        var inp = box.querySelector(".fo-dec-in");
        inp.value = String(o.input.value == null ? "" : o.input.value);
        if (o.input.placeholder) inp.placeholder = String(o.input.placeholder);
      }
      box.querySelector(".fo-dec-no").textContent = String(o.cancel || "Cancel");
      box.querySelector(".fo-dec-yes").textContent = String(o.ok || "Confirm");
      var shown = el.style.display;
      el.style.display = "none";
      el.parentNode.insertBefore(box, el.nextSibling);
      var close = function () {
        try { document.removeEventListener("keydown", onKey); } catch (e) {}
        try { el.style.display = shown || ""; } catch (e) {}
        try { if (box.parentNode) box.parentNode.removeChild(box); } catch (e) {}
      };
      var onKey = function (e) { if (e.key === "Escape") { close(); try { el.focus(); } catch (e2) {} } };
      document.addEventListener("keydown", onKey);
      box.querySelector(".fo-dec-no").addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation(); close(); try { el.focus(); } catch (e2) {}
      });
      var commit = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        var v = o.input ? box.querySelector(".fo-dec-in").value : undefined;
        close();
        try { if (o.onYes) o.onYes(v); } catch (e2) { try { console.warn("foDecide", e2); } catch (e3) {} }
      };
      box.querySelector(".fo-dec-yes").addEventListener("click", commit);
      // typing a figure and pressing Enter is the same as pressing the verb
      if (o.input) box.querySelector(".fo-dec-in").addEventListener("keydown", function (e) {
        if (e.key === "Enter") commit(e);
      });
      // with a field to fill the cursor belongs in it; without one the SAFE
      // choice holds focus so Enter can never destroy anything
      try { box.querySelector(o.input ? ".fo-dec-in" : ".fo-dec-no").focus(); } catch (e) {}
      try { box.scrollIntoView({ block: "nearest" }); } catch (e) {}
    } catch (eD) { try { if (opts && opts.onYes) opts.onYes(); } catch (e2) {} }
  }
  // A LINE THAT SAYS WHY, where the thing that failed is. Same idea as the
  // decision strip: an error belongs beside the control that produced it, not
  // over the whole page.
  function foSayAt(el, msg, kind) {
    try {
      if (!el || !el.parentNode) { try { console.warn("[fifty-overs] " + msg); } catch (e) {} return; }
      foDecCss();
      var ex = el.parentNode.querySelector(".fo-dec[data-fo-note='1']");
      if (ex) ex.remove();
      var n = document.createElement("div");
      n.className = "fo-dec" + (kind === "error" ? " dngr" : "");
      n.setAttribute("data-fo-note", "1");
      n.innerHTML = "<b></b>";
      n.querySelector("b").textContent = String(msg || "").slice(0, 300);
      el.parentNode.insertBefore(n, el.nextSibling);
      setTimeout(function () { try { if (n.parentNode) n.parentNode.removeChild(n); } catch (e) {} }, 9000);
    } catch (e) { try { console.warn("[fifty-overs] " + msg); } catch (e2) {} }
  }
  try { window.foDecide = foDecide; window.foSayAt = foSayAt; } catch (eX) {}

  function foConfirm(opts) {
    return new Promise(function (res) {
      var old = document.getElementById("fo-modal"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "fo-modal";
      d.innerHTML = "<div class='fo-mo-back'><div class='fo-mo-card" + (opts.danger ? " fo-mo-dngr" : "") + "'>" +
        "<div class='fo-mo-ic'>" + FO_I(opts.danger ? "warn" : "info", 22) + "</div>" +
        "<h3>" + E(opts.title || "Are you sure?") + "</h3>" +
        (opts.body ? "<p>" + E(opts.body) + "</p>" : "") +
        "<div class='fo-mo-act'><button class='fo-mo-cancel'>" + E(opts.cancel || "Cancel") + "</button>" +
        "<button class='fo-mo-ok'>" + E(opts.confirm || "Confirm") + "</button></div></div></div>";
      document.body.appendChild(d);
      var done = function (v) { try { document.removeEventListener("keydown", onKey); } catch (e) {} d.classList.remove("on"); setTimeout(function () { d.remove(); }, 180); res(v); };
      var onKey = function (e) { if (e.key === "Escape") done(false); };
      document.addEventListener("keydown", onKey);
      d.querySelector(".fo-mo-cancel").addEventListener("click", function () { done(false); });
      d.querySelector(".fo-mo-ok").addEventListener("click", function () { done(true); });
      d.querySelector(".fo-mo-back").addEventListener("click", function (e) { if (e.target.classList.contains("fo-mo-back")) done(false); });
      requestAnimationFrame(function () { d.classList.add("on"); try { d.querySelector(".fo-mo-cancel").focus(); } catch (e) {} });
    });
  }
  function headers() { return { apikey: ANON, Authorization: "Bearer " + (JWT || ANON), "content-type": "application/json", "Accept-Profile": "app", "Content-Profile": "app" }; }
  // NO REQUEST MAY HANG THE GAME FOREVER. Every screen that talks to the server
  // handles a rejection - it shows an error, a lobby, a front door. None of them
  // handle a promise that simply never settles, and on a phone that is exactly
  // what a stalled connection produces: no error, no timeout, no next event.
  // That is how a manager ends up staring at "Signing you in…" indefinitely.
  // A request that has not answered in this long is treated as a failure, which
  // every caller already knows how to recover from.
  var NET_TIMEOUT = 25000;
  function foFetch(url, opt) {
    var o = opt || {};
    var ctl = null;
    try { ctl = new AbortController(); o = Object.assign({}, o, { signal: ctl.signal }); } catch (e) { ctl = null; }
    var timer = null;
    var kill = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        // reject BEFORE aborting · the other way round the browser's own
        // "signal is aborted without reason" wins the race and that is what
        // the manager reads on the error card
        reject(new Error("the server did not answer in time"));
        try { if (ctl) ctl.abort(); } catch (e2) {}
      }, NET_TIMEOUT);
    });
    return Promise.race([fetch(url, o), kill]).then(
      function (r) { clearTimeout(timer); return r; },
      function (e) { clearTimeout(timer); throw e; }
    );
  }
  // WHAT THE WIRE IS ACTUALLY DOING. A manager stuck on a loading line can tell
  // me the words on it and nothing else, and the words name a stage, not a
  // request. So every call keeps its name and its timing, and the stuck card
  // prints the last handful: one photograph then says which request has not
  // come back, and how long the rest took.
  // NAME THE FUNCTION THAT FROZE THE PAGE. A desktop sat a full minute on the
  // loading card with its own seconds counter stopped at 2 - meaning some
  // callback held the main thread the whole time, and a still image cannot say
  // which. So every timer callback registered from here on runs through a
  // stopwatch: anything that keeps the thread longer than 800ms is recorded
  // with its source, and the loading and stuck cards print the worst of it.
  // The culprit signs its own confession on the next screenshot.
  var SLOW_LOG = [];
  function foSlowWrap(fn) {
    if (typeof fn !== "function") return fn;
    return function () {
      var t0 = Date.now();
      try { return fn.apply(this, arguments); }
      finally {
        var dt = Date.now() - t0;
        if (dt > 800) {
          try {
            SLOW_LOG.push({ ms: dt, src: String(fn).replace(/\s+/g, " ").slice(0, 110) });
            if (SLOW_LOG.length > 5) SLOW_LOG.shift();
            // a block the manager can FEEL is named on screen as it happens -
            // "glitchy" stops being a mystery word when the culprit signs the
            // toast. Throttled so a repeat offender nags once, not constantly.
            if (dt > 2500 && Date.now() - (foSlowWrap.__toastAt || 0) > 30000) {
              foSlowWrap.__toastAt = Date.now();
              var nm = (String(fn).match(/function\s+([A-Za-z0-9_$]+)/) || [])[1] || "an unnamed callback";
              toast("Slow spell: " + nm + " held the page for " + (dt / 1000).toFixed(1) + "s", "error");
            }
          } catch (eS) {}
        }
      }
    };
  }
  function foSlowReport() {
    return SLOW_LOG.slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 2)
      .map(function (s) { return "BLOCKED " + (s.ms / 1000).toFixed(1) + "s by: " + s.src; });
  }
  try {
    var _fST = window.setTimeout, _fSI = window.setInterval;
    window.setTimeout = function (fn, ms) { var a = [].slice.call(arguments); a[0] = foSlowWrap(fn); return _fST.apply(window, a); };
    window.setInterval = function (fn, ms) { var a = [].slice.call(arguments); a[0] = foSlowWrap(fn); return _fSI.apply(window, a); };
  } catch (eW) {}

  var NET_LOG = [];
  function netRec(name) {
    var r = { n: name, t0: Date.now(), ms: 0, ok: null };
    NET_LOG.push(r); if (NET_LOG.length > 14) NET_LOG.shift();
    return r;
  }
  function netDone(r, ok) { r.ms = Date.now() - r.t0; r.ok = !!ok; }
  function foNetReport() {
    return NET_LOG.slice(-8).map(function (r) {
      if (r.ok === null) return r.n + " · still waiting, " + Math.round((Date.now() - r.t0) / 1000) + "s";
      return r.n + " · " + (r.ok ? "" : "failed after ") + (r.ms / 1000).toFixed(1) + "s";
    });
  }
  function rpc(fn, args) {
    var rec = netRec(fn);
    return foFetch(URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: headers(), body: JSON.stringify(args || {}) }).then(function (r) {
      return r.text().then(function (t) { netDone(rec, r.ok); if (!r.ok) throw new Error(t || ("HTTP " + r.status)); return t ? JSON.parse(t) : null; });
    }, function (e) { netDone(rec, false); throw e; });
  }
  function sel(table, q) {
    var rec = netRec(table);
    return foFetch(URL + "/rest/v1/" + table + "?" + (q || ""), { headers: headers() }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { netDone(rec, false); throw new Error(t); });
      // PARSE FROM THE BYTES, NOT VIA A STRING. r.text() first builds a
      // JavaScript string of the entire body, and a string is UTF-16 - so a
      // two-megabyte season becomes four megabytes of string, held alongside
      // the object graph it is about to be parsed into, on top of whatever the
      // game already has in memory. r.json() reads straight from the response
      // and never materialises the middle copy. On a phone that is the
      // difference between opening the season and the tab being killed.
      return r.json().then(function (v) { netDone(rec, true); return v; });
    }, function (e) { netDone(rec, false); throw e; });
  }
  // small localStorage wrapper (private mode / disabled storage safe)
  var PEND = "fol_pending_invite";
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  // reports whether the write actually stuck · a phone in private browsing, or
  // one whose storage is full, accepts the call and keeps nothing
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return window.localStorage.getItem(k) === v; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { } }

  // ---- stay logged in across refreshes: persist + restore the Supabase session ----
  var SESS = "fol_session";
  function saveSession(d) {
    if (!d || !d.access_token) return;
    var exp = d.expires_at ? d.expires_at * 1000 : (Date.now() + ((d.expires_in || 3600) * 1000));
    lsSet(SESS, JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token || "", expires_at: exp }));
  }
  function clearSession() { lsDel(SESS); }
  // Where Supabase should send the user after they confirm their email / reset a
  // password. Must be added to the project's Auth "Redirect URLs" allow-list.
  var APP_URL = location.origin + location.pathname;
  // When the user returns from an email confirmation / recovery link, Supabase
  // appends the session (or an error) to the URL fragment. Consume it so we log in
  // instead of showing a blank routed page.
  function foConsumeAuthHash() {
    try {
      // The engine's boot rewrites location.hash to #/welcome before this overlay
      // runs, wiping the Supabase fragment · so also read the ORIGINAL navigation
      // URL (captured at page load) to recover the token / error.
      var cands = [];
      if (location.hash) cands.push(location.hash);
      try { var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0]; if (nav && nav.name) cands.push(nav.name); } catch (e) {}
      if (document.URL) cands.push(document.URL);
      var sawError = false;
      for (var ci = 0; ci < cands.length; ci++) {
        var u = cands[ci], hi = u.indexOf("#"); if (hi < 0) continue;
        var raw = u.slice(hi + 1).replace(/^\/?/, "");
        if (/(^|&)access_token=/.test(raw)) {
          var q = {}; raw.split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
          if (q.access_token) {
            JWT = q.access_token;
            var d = { access_token: q.access_token, refresh_token: q.refresh_token || "" };
            if (q.expires_at) d.expires_at = +q.expires_at; else d.expires_in = q.expires_in ? +q.expires_in : 3600;
            saveSession(d);
            try { history.replaceState(null, "", location.pathname + location.search + "#/club"); } catch (e) {}
            return "ok";
          }
        }
        if (/(^|&)error/.test(raw)) sawError = true;
      }
      if (sawError) { try { history.replaceState(null, "", location.pathname + location.search + "#/club"); } catch (e) {} return "error"; }
    } catch (e) {}
    return "";
  }
  function restoreSession() {
    var raw = lsGet(SESS); if (!raw) return Promise.resolve(false);
    var s; try { s = JSON.parse(raw); } catch (e) { clearSession(); return Promise.resolve(false); }
    if (!s || !s.access_token) { clearSession(); return Promise.resolve(false); }
    if (s.expires_at && (s.expires_at - Date.now() > 60000)) { JWT = s.access_token; return Promise.resolve(true); }
    if (!s.refresh_token) { clearSession(); return Promise.resolve(false); }
    return refreshSession(s.refresh_token, 0);
  }
  // A REFRESH THAT FAILS IS NOT A SESSION THAT IS DEAD. Tokens last an hour,
  // so nearly every return visit renews one over the network - and a phone's
  // network is exactly the thing that flakes while a page loads. Only the
  // auth server actually refusing the token ends the session; anything else -
  // a dropped request, a gateway error, airplane mode - keeps the stored
  // session and tries again: once straight away, then quietly in the
  // background, repainting the page the moment a retry lands.
  function refreshSession(tok, attempt) {
    return fetch(URL + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ refresh_token: tok }) })
      .then(function (r) { return r.text().then(function (t) {
        var d = null; try { d = JSON.parse(t); } catch (eP) {}
        if (r.ok && d && d.access_token) { JWT = d.access_token; saveSession(d); return true; }
        if (r.status >= 400 && r.status < 500) { clearSession(); return false; }
        throw new Error("HTTP " + r.status);
      }); })
      .catch(function () {
        if (attempt < 1) return new Promise(function (res) { setTimeout(res, 2000); }).then(function () { return refreshSession(tok, attempt + 1); });
        lateRestore();
        return false;
      });
  }
  var lateTries = 0;
  function lateRestore() {
    if (lateTries >= 10) return;
    lateTries++;
    setTimeout(function () {
      if (JWT || !lsGet(SESS)) return;
      restoreSession().then(function (ok) {
        if (!ok) return;
        try {
          var pg = document.getElementById("page");
          if (pg) { pg.__foLgSig = null; pg.__foPmSig = null; pg.__foHomeSig = null; pg.__foClSig = null; pg.__foSig = null; }
          if (typeof window.route === "function") window.route();
        } catch (eLr) {}
      });
    }, 30000);
  }

  // A SESSION BEING RESTORED IS NOT A SESSION THAT IS ABSENT.
  // restoreSession is asynchronous - a token within a minute of expiry is
  // refreshed over the network first - so for as long as that takes, __foJWT()
  // answers "". Every room that keeps its own books behind a sign-in read
  // that as SIGNED OUT and printed so, on a device whose session was about to
  // come back. Worse, nothing repainted when it did: the manager was left
  // looking at "sign in to the account that holds your club" while holding it.
  //
  // So the device says which of the two it is. While a stored session is
  // being made good the answer is "not yet", not "no"; and the moment it
  // settles, whatever is on screen is drawn again.
  try { window.__foAuthPending = !!lsGet(SESS); } catch (eAp0) { window.__foAuthPending = false; }
  function foAuthSettled() {
    if (!window.__foAuthPending) return;
    window.__foAuthPending = false;
    try {
      var pg = document.getElementById("page");
      if (pg) { pg.__foLgSig = null; pg.__foPmSig = null; pg.__foHomeSig = null; pg.__foClSig = null; pg.__foSig = null; }
      if (typeof window.route === "function") window.route();
    } catch (eAs) {}
  }
  try { window.__foAuthSettled = foAuthSettled; } catch (eAs2) {}
  (function () {
    var _rs = restoreSession;
    restoreSession = function () {
      var p;
      try { p = _rs.apply(this, arguments); } catch (eR) { foAuthSettled(); throw eR; }
      return Promise.resolve(p).then(
        function (v) { foAuthSettled(); return v; },
        function (eR2) { foAuthSettled(); throw eR2; });
    };
  })();
  // and a session that is never restored at all must not hang the wait
  setTimeout(function () { try { foAuthSettled(); } catch (eT) {} }, 8000);

  // A CARD THAT SAYS "SIGN IN" MUST BE A DOOR. The only way back into a
  // signed-out account used to be the Log out pill at the far end of the nav,
  // which doubles as Sign in when there is no session - a door nobody can
  // find. Any room may now print a real button: mark it data-fo-door and this
  // one listener opens the front gate from anywhere.
  try {
    document.addEventListener("click", function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-fo-door]") : null;
      if (!el) return;
      ev.preventDefault();
      try { if (typeof window.foDoorOpen === "function") window.foDoorOpen(); } catch (eD2) {}
    });
    var ds = document.createElement("style"); ds.id = "fo-door-css";
    ds.textContent =
      "html body button.fo-door-btn,html body.ftpskin #page button.fo-door-btn{display:inline-block;margin-top:13px;" +
      "font:700 12px Oswald,sans-serif !important;letter-spacing:.18em;text-transform:uppercase;" +
      "background:#C9571F !important;color:#fff !important;border:none !important;border-radius:10px;" +
      "padding:12px 26px;cursor:pointer;min-height:0}" +
      "html body button.fo-door-btn:hover{background:#A64426 !important}";
    (document.head || document.documentElement).appendChild(ds);
  } catch (eDoor) {}

  // ---- cross-device cloud saves (needs the 0022 migration; fails silently
  // until it is run). The whole game state already lives in fo_*/fol_*
  // localStorage keys (career save, circuit progress, journey flags), so the
  // cloud copy is simply that key set, one row per account. Pushes ride the
  // engine's own autosaves (debounced); the pull runs once per sign-in and
  // ASKS before replacing this device's progress - it never clobbers quietly. ----
  var CLOUD_TS = "fo_cloud_ts";                 // updated_at of the copy this device last wrote/loaded
  var FO_CLOUD_SKIP = { fol_session: 1, fo_cloud_ts: 1, fo_bldseen: 1, fo_world_feed_cache: 1, fo_world_rk: 1 };   // device-local, never synced
  function foCloudKeys() {
    var out = {};
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (!k || (k.indexOf("fo_") !== 0 && k.indexOf("fol_") !== 0)) continue;
        if (FO_CLOUD_SKIP[k] || k.indexOf("fol_clubmeta_") === 0 || k.indexOf("fo_world_lg_") === 0 || k.indexOf("fo_world_nm_") === 0) continue;
        out[k] = window.localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }
  function foCloudHash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return String(h >>> 0); }
  var foCloudBusy = false, foCloudSent = "", foCloudTimer = null;
  function foCloudPush(force) {
    try {
      if (!JWT || foCloudBusy || foCloudPush.__blocked) return;
      var body = JSON.stringify([{ data: { ls: foCloudKeys() } }]);
      var h = foCloudHash(body);
      if (!force && h === foCloudSent) return;    // nothing changed since the last push
      foCloudBusy = true;
      var hh = headers(); hh.Prefer = "resolution=merge-duplicates,return=representation";
      fetch(URL + "/rest/v1/player_saves?on_conflict=user_id", { method: "POST", headers: hh, body: body })
        .then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t); return t ? JSON.parse(t) : null; }); })
        .then(function (rows) {
          foCloudSent = h;
          try { if (rows && rows[0] && rows[0].updated_at) lsSet(CLOUD_TS, rows[0].updated_at); } catch (e) {}
          foCloudBusy = false;
        }, function () { foCloudBusy = false; });
    } catch (e) { foCloudBusy = false; }
  }
  // Seeding the cloud means uploading the whole career, and a phone's uplink is
  // narrower than its downlink · it waits until the league is actually open, or
  // half a minute, whichever comes first.
  function foCloudLater(fn) {
    var n = 0;
    var t = setInterval(function () {
      var open = false;
      try { open = !!(SYNC && SYNC.started); } catch (e) {}
      if (open || ++n > 30) { clearInterval(t); try { fn(); } catch (e2) {} }
    }, 1000);
  }
  function foCloudQueue() {
    if (!JWT) return;
    if (foCloudTimer) clearTimeout(foCloudTimer);
    foCloudTimer = setTimeout(function () { foCloudTimer = null; foCloudPush(false); }, 12000);
  }
  // A DEVICE THAT CANNOT KEEP THE SAVE MUST NOT RELOAD.
  // Taking the cloud career ends in location.reload(), so the engine boots on
  // the restored save rather than the one already in memory. That is fine right
  // up until the writes do not stick - private browsing, a full quota, a phone
  // that has quietly run out of room. Then the next boot sees the same cloud
  // copy it has "already" taken, applies it again, reloads again, and the
  // manager watches "Signing you in…" forever while the tab reloads several
  // times a second. Measured: 132 reloads in fifteen seconds.
  // So: prove the store accepts a write before touching anything, write the
  // career before deleting what it replaces, and only reload once everything
  // is safely down. A device that cannot hold the save keeps the one it has
  // and is told why, which is worth far more than a spinner.
  var RELOADED = "foCloudApplied";
  function foCloudLoad(row) {
    try {
      var ls = row && row.data && row.data.ls; if (!ls) return;
      // window.name survives a same-tab reload without needing storage, which
      // is exactly the thing we cannot trust here · one application per tab
      try { if ((window.name || "").indexOf(RELOADED) >= 0) return; } catch (eN) {}
      if (!lsSet(CLOUD_TS, row.updated_at || "")) { foCloudNoRoom(); return; }
      // MAKE ROOM BEFORE MEASURING IT. The old copy of this very save is the
      // biggest thing in the drawer; clearing the keys the cloud is about to
      // replace frees their space for the incoming versions. Only fo_*/fol_*
      // keys the cloud carries are touched - the session survives untouched.
      try { for (var kP in ls) { if (kP.indexOf("fo_") === 0 || kP.indexOf("fol_") === 0) lsDel(kP); } } catch (ePre) {}
      // THE CAREER OUTRANKS EVERYTHING ELSE IN THE DRAWER. All-or-nothing was
      // safe but cruel: one oversized side key locked a manager out of their
      // whole career on the phone. Now the keys are written biggest-first with
      // the career at the front of the queue, and a lesser key that will not
      // fit is simply skipped - it lives on the server and regenerates. Only
      // when the CAREER ITSELF cannot fit does the device keep what it had
      // and say so.
      var names = []; for (var k2 in ls) names.push(k2);
      names.sort(function (a, b) {
        var ca = a === "fo_save_v11_3_pace_tuned" ? 0 : 1, cb = b === "fo_save_v11_3_pace_tuned" ? 0 : 1;
        if (ca !== cb) return ca - cb;
        return String(ls[b] || "").length - String(ls[a] || "").length;
      });
      var skipped = [];
      for (var n2 = 0; n2 < names.length; n2++) {
        var key = names[n2];
        if (lsSet(key, ls[key])) continue;
        if (key === "fo_save_v11_3_pace_tuned") {   // the career would not fit: keep what this device had
          names.slice(0, n2).forEach(function (k) { lsDel(k); });
          lsDel(CLOUD_TS);
          foCloudNoRoom(); return;
        }
        skipped.push(key);
      }
      if (skipped.length) {
        try { console.warn("Fifty Overs: no room for " + skipped.length + " side key(s), kept on the server:", skipped.join(", ")); } catch (eSk) {}
      }
      // stale local fo_* keys from another save would blend into the loaded
      // one - clear anything the cloud copy does not carry (session survives).
      // The pre-clear above only removed keys the cloud was replacing; this
      // sweeps the ones it does not know about at all.
      var kill = [];
      try {
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (!k || (k.indexOf("fo_") !== 0 && k.indexOf("fol_") !== 0)) continue;
          if (FO_CLOUD_SKIP[k]) continue;
          if (!(k in ls)) kill.push(k);
        }
      } catch (e) {}
      kill.forEach(function (k) { lsDel(k); });
      try { window.name = (window.name || "") + RELOADED; } catch (eN2) {}
      location.reload();
    } catch (e) { say(e); }
  }
  // Said once, and only on the device that has the problem.
  function foCloudNoRoom() {
    try {
      if (foCloudNoRoom.__said) return; foCloudNoRoom.__said = 1;
      foCloudPush.__blocked = 1;   // never overwrite the cloud copy from here
      say("This browser cannot hold your career's offline copy. Nothing is lost — your club lives on the server and plays on. If this is a private/incognito window, a normal one will fix it.");
    } catch (e) {}
  }
  function foCloudBoot() {
    try {
      if (!JWT || foCloudBoot.__ran) return; foCloudBoot.__ran = 1;
      // ASK FOR THE STAMP, NOT THE CAREER.
      // This runs the moment you sign in, alongside the four small requests
      // that open the league - and it used to download the whole save every
      // time, several megabytes of it, whether or not this device already had
      // that copy. On a phone that is the widest thing on a narrow pipe, and
      // everything else queues behind it. The stamp is a few bytes and answers
      // the only question there is: am I already carrying this? The career
      // itself is fetched in the one case that needs it.
      sel("player_saves", "select=updated_at&limit=1").then(function (rows) {
        var row = rows && rows[0];
        if (!row) { foCloudLater(function () { foCloudPush(true); }); return; }  // first device: seed the cloud
        if (lsGet(CLOUD_TS) === row.updated_at) return;                          // already carrying this copy
        // the cloud career IS the career: whichever device signs in picks it
        // up, no prompt - the newest cloud copy always wins
        return sel("player_saves", "select=data,updated_at&limit=1").then(function (full) {
          var r2 = full && full[0];
          if (r2 && r2.data && r2.data.ls) foCloudLoad(r2);
          else foCloudLater(function () { foCloudPush(true); });   // a row with nothing in it
        });
      }).catch(function () {});
      // pushes ride the engine's autosave, plus a safety net on tab-hide
      setTimeout(function () {
        try {
          if (typeof window.saveGame === "function" && !window.saveGame.__foCloud) {
            var _sv = window.saveGame;
            window.saveGame = function () { var r = _sv.apply(this, arguments); try { foCloudQueue(); } catch (e) {} return r; };
            window.saveGame.__foCloud = 1;
          }
        } catch (e) {}
      }, 0);
      document.addEventListener("visibilitychange", function () { try { if (document.visibilityState === "hidden") foCloudPush(false); } catch (e) {} });
      setInterval(function () { foCloudPush(false); }, 240000);
    } catch (e) {}
  }
  try { window.__foCloud = { keys: foCloudKeys, push: foCloudPush, load: foCloudLoad, boot: foCloudBoot }; } catch (eCw) {}
  // the joinable world (module 37) needs the caller's identity for its RPCs
  try { window.__foJWT = function () { return JWT || ""; }; } catch (eJw) {}
  // THE BRIDGE OUT OF THIS CLOSURE.
  // The league core is one IIFE spanning modules 00 to 12. Everything numbered
  // 13 and up is a separate IIFE, so LG, SYNC, sel and rpc are simply not in
  // scope there - a bare `SYNC` throws ReferenceError, and a try/catch around
  // it quietly turns "am I in a served league?" into "no". That is how the
  // world clock came to believe every device was playing solo. Anything
  // outside the core asks here instead.
  try {
    window.__foLeague = function () {
      var live = false, id = "", mine = null;
      try { live = !!(SYNC && SYNC.started && !SYNC.practice); } catch (e1) {}
      try { id = (LG && LG.id) || ""; } catch (e2) {}
      try { mine = (SYNC && SYNC.me) || null; } catch (e3) {}
      return { id: id, live: live, me: mine, sel: sel, rpc: rpc };
    };
  } catch (eLg) {}

  // ---- styles + shell ----
  // (login skin is static now: engine/src/skin/10-login.css -> <style id="fo-skin-login">)

  // ---- Fifty Overs identity: navy + terracotta, teal accents (login) ----
  // (modal skin is static now: engine/src/skin/20-modal.css -> <style id="fo-skin-modal">)

  // ---- restyle the GAME itself: brand colours (navy/terracotta/teal) on the
  //      light background, and proper mobile layout. Injected after the game's
  //      own <style>, so it wins without touching the pinned engine file. ----
  // (the brand sheet is static now: engine/src/skin/30-brand.css -> <style id="fo-brand">,
  //  placed at the end of <body> so it stays the last stylesheet)
  // The game injects its own theme stylesheets into <body> at render time, after
  // ours. Keep our brand sheet the LAST stylesheet so it always wins.
  // The game's two voices, self-hosted so they arrive on every device and
  // every network: Oswald (variable, 200-700) carries the display type and
  // labels; Inter (variable, 100-900) carries the UI. The old Google Fonts
  // link died silently offline and on blocked networks, leaving letter-spaced
  // condensed layouts rendered in a default sans - the whole page went weird.
  try {
    if (!document.getElementById("fo-font")) {
      var fbase = (location.pathname.indexOf("/client/") !== -1) ? "fonts/" : "client/fonts/";
      var ff = document.createElement("style");
      ff.id = "fo-font";
      ff.textContent =
        "@font-face{font-family:'Oswald';font-style:normal;font-weight:200 700;font-display:swap;src:url(" + fbase + "oswald-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}" +
        "@font-face{font-family:'Oswald';font-style:normal;font-weight:200 700;font-display:swap;src:url(" + fbase + "oswald-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}" +
        "@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(" + fbase + "inter-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}" +
        "@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(" + fbase + "inter-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}" +
        // Fraunces: the almanack voice - variable optical-size serif for display
        "@font-face{font-family:Fraunces;font-style:normal;font-weight:300 700;font-display:swap;src:url(" + fbase + "fraunces-normal-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}" +
        "@font-face{font-family:Fraunces;font-style:normal;font-weight:300 700;font-display:swap;src:url(" + fbase + "fraunces-normal-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}";
      document.head.appendChild(ff);
    }
  } catch (e) {}
  function bumpBrand() { try { var b3 = document.getElementById("fo-brand"); if (b3 && (b3.parentNode !== document.body || document.body.lastChild !== b3)) document.body.appendChild(b3); } catch (e) {} }
  // Add a "Clubs" nav link -> the game's players browser (pick any club, bot or
  // human, and see its roster). The game ships the page but never links to it.
  // The game runs in days, not weeks: the engine's "Week N" chip goes.
  function foHideWeekChip() {
    try {
      document.querySelectorAll("#fo-top-status span").forEach(function (s) {
        if (/^\s*(Week\s+\d+|Bank\b|Next:)/.test(s.textContent || "")) s.style.display = "none";
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foHideWeekChip, 80); setTimeout(foHideWeekChip, 400); });
  // The engine rewrites #fo-top-status (Week/Bank/Next chips) on its own
  // schedule, resurrecting the chips we hide. Wrap its renderer and watch the
  // topbar so the hide always lands last.
  try {
    if (typeof window.updateTopbarStatus === "function" && !window.updateTopbarStatus.__fo) {
      var _foUts = window.updateTopbarStatus;
      window.updateTopbarStatus = function () { var r = _foUts.apply(this, arguments); foHideWeekChip(); return r; };
      window.updateTopbarStatus.__fo = 1;
    }
  } catch (e) {}
  // The mobile drawer is gone with the hamburger that opened it: the menu
  // bar under the masthead is the one index, at every width.

  /* THE RIGHT EDGE OF THE MASTHEAD IS ONE GROUP.
   *
   * The world clock pins itself to the corner with position:absolute, which
   * means anything that wants to sit BESIDE it cannot simply be put next to
   * it in the flow - the clock is not in the flow. That is why the bells ended
   * up at the far left, beside the old menu button: it was the only place in
   * the masthead where their position was knowable.
   *
   * Rather than have each bell guess an offset from a clock whose width
   * changes with the date, one absolutely-positioned box owns the right edge
   * and everything in it lays out normally inside. The clock goes back to
   * being an ordinary element, and a bell is placed by putting it before the
   * clock - which is exactly what "just to the left of the date and time"
   * means, and it stays true at any width and in any language.
   *
   * Order is asserted on every pass because the bells mount on their own
   * timers and may arrive after the clock; a node already in the right place
   * is left alone, so this does not churn the DOM once it has settled.
   */
  /* THE LIVE PILL BELONGS IN THIS ROW TOO, and it was the one thing in that
     corner that was not. #fo-hdr-right is absolutely positioned against the
     masthead's right edge; the pill was inserted straight into #topbar and
     laid out in normal flow, so the two ended up occupying the same corner and
     the pill sat on top of the bell. Anything that lives at the right of the
     masthead goes in the box that owns the right of the masthead - then the
     flex gap keeps them apart and no z-index has to arbitrate.
     It leads the row: on air outranks a notification, which outranks a clock. */
  var FO_HDR_RIGHT = ["#fo-mlive", "#fo-bell", "#fo-nbell", "#fo-wire-btn", "#fo-clock", "#fo-wclock"];
  function foHdrRight(tb) {
    try {
      if (!tb) tb = document.getElementById("topbar");
      if (!tb) return;
      var rt = tb.querySelector("#fo-hdr-right");
      if (!rt) {
        rt = document.createElement("div"); rt.id = "fo-hdr-right";
        tb.appendChild(rt);
      }
      var want = [];
      FO_HDR_RIGHT.forEach(function (sel) {
        var el = tb.querySelector(sel) || document.querySelector(sel);
        if (el) want.push(el);
      });
      var have = [].slice.call(rt.children);
      var same = have.length === want.length && want.every(function (el, i) { return have[i] === el; });
      if (!same) want.forEach(function (el) { rt.appendChild(el); });
    } catch (e) {}
  }
  // the bell is built by the matchday module, which cannot see this function
  // unless it is put somewhere both can reach
  try { window.foHdrRight = foHdrRight; } catch (eHR) {}
  try {
    if (!document.getElementById("fo-hdr-right-css")) {
      var hrS = document.createElement("style"); hrS.id = "fo-hdr-right-css";
      hrS.textContent = [
        "html body #topbar #fo-hdr-right{position:absolute;right:10px;top:50%;transform:translateY(-50%);" +
          "display:flex;align-items:center;gap:9px;z-index:5}",
        // the clock stops pinning itself now that the box it sits in does
        "html body #topbar#topbar #fo-hdr-right #fo-wclock{position:static;transform:none;right:auto;top:auto;margin:0}",
        "html body #topbar #fo-hdr-right #fo-wire-btn,html body #topbar #fo-hdr-right #fo-bell,html body #topbar #fo-hdr-right #fo-nbell,html body #topbar #fo-hdr-right #fo-mlive{position:relative;margin:0;flex:none;top:auto;right:auto;left:auto;bottom:auto;transform:none}",
        "html body #topbar #fo-hdr-right:empty{display:none}",
        /* THE BELL USED TO FLY ACROSS THE MASTHEAD ON EVERY PAINT.
           It is created by the matchday module as a direct child of #topbar,
           where the bar's own rules put it hard against the clock, and only
           afterwards does foHdrRight move it into the group on the right. That
           left one painted frame with the bell sitting on top of the date and
           the time before it snapped back - on every navigation and every
           reload, which is exactly when a reader is looking at the masthead.
           A control that has not been placed yet is not shown. The moment it
           lands inside #fo-hdr-right it stops being a direct child of the bar
           and this rule stops applying to it, so nothing has to remember to
           turn it back on. */
        "html body #topbar > #fo-bell,html body #topbar > #fo-nbell,html body #topbar > #fo-wire-btn,html body #topbar > #fo-mlive," +
          "html body #topbar > #fo-clock,html body #topbar > #fo-wclock{visibility:hidden}",
        // THE MASTHEAD KEEPS ITS HEIGHT. Its 46px came from nothing but the
        // 44px menu button standing in it; with the button gone the bar
        // collapsed to 42 on a desktop and 28 on a phone, and the world clock
        // - which is taller than either - hung out of the top and bottom of
        // it. The height is stated now rather than being a side effect of
        // whichever child happened to be tallest.
        "html body #topbar,html body.ftpskin #topbar{min-height:46px}"
      ].join("\n");
      document.head.appendChild(hrS);
    }
  } catch (eHr) {}
  try { setInterval(function () { foHdrRight(null); }, 1200); } catch (eHr2) {}
  // phones: the topbar's Next chip gives way to a red Live button whenever
  // something is actually on air (own live match, or the broadcast hour)
  function foMliveTick() {
    try {
      var ml = document.getElementById("fo-mlive"); if (!ml) return;
      var go = null, mineNow = false;
      // THE PILL IS A SUMMONS, NOT A TICKER. It lights for MY club's match
      // and for nothing else - spectating another club's broadcast is a
      // choice, not an alarm. A live match someone else is playing announces
      // itself beside its own row, where it belongs.
      try {
        if (typeof M !== "undefined" && M && !M.done) {
          var myNmM = ""; try { myNmM = ((typeof foMyClub === "function" && foMyClub()) || userTeam() || {}).name || ""; } catch (eNm0) {}
          var mMine = !(M.meta && M.meta.__spectate) ||
            (M.meta && myNmM && (M.meta.home === myNmM || M.meta.away === myNmM));
          if (mMine) { go = "#/match"; mineNow = true; }
        }
      } catch (e0) {}
      if (!go) { try { var em = (typeof foEmbargo === "function") ? foEmbargo() : null; if (em && em.active && !em.pre) { go = "#/matchday"; mineNow = true; } } catch (e1) {} }
      // MY CLUB'S OWN LEAGUE MATCH, which nothing above this could see.
      // A league fixture resolves on the server, so M is null; and the
      // embargo window is read off the last round banked on THIS device,
      // which a manager who has not opened the matchday centre simply does
      // not have. So the one match he actually cares about was the one match
      // the pill stayed dark through. The world clock knows: it says which
      // round is in play for his nation and at what hour, and the fixture
      // list says which of those matches is his.
      if (!go) {
        try {
          var wt9 = (window.__foWT && window.__foWT.serverFixtures) ? window.__foWT : null;
          var pl9 = window.__foPlanet || null;
          var nat9 = (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "";
          if (wt9 && pl9 && nat9) {
            var now9 = Date.now(), sv9 = wt9.serverFixtures(nat9, now9), h9 = pl9.natHour(nat9);
            var hN9 = (now9 - (pl9.EPOCH + pl9.dayIx(now9) * 86400000)) / 3600000;
            if ((sv9.fx || []).length && hN9 >= h9 && hN9 < h9 + (pl9.LIVE_LEN || 3)) {
              var mine9 = ""; try { mine9 = foMyClub() || (userTeam() || {}).name || ""; } catch (eM9) {}
              var cl9 = null;
              try { cl9 = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eC9) {}
              var slot9 = (cl9 && cl9.country === nat9) ? cl9.slot : -1;
              var is9 = function (sd) { return !!sd && ((slot9 >= 0 && sd.slot === slot9) || (mine9 && sd.name === mine9)); };
              sv9.fx.forEach(function (f9, i9) {
                if (go || !f9 || !(is9(f9.home) || is9(f9.away))) return;
                go = "#/feed?n=" + encodeURIComponent(nat9) + "&f=" + i9;
                mineNow = true;
              });
            }
          }
        } catch (e9) {}
      }
      if (!go) {
        // a friendly or practice broadcast of MY club counts as on air too
        try {
          var myNm = null; try { myNm = (foMyClub() || userTeam()).name; } catch (eN) {}
          ((window.__foFrAll) || []).forEach(function (c2) {
            if (go || !c2 || (c2.status !== "accepted" && c2.status !== "played")) return;
            if (myNm && c2.challenger_club !== myNm && c2.opponent_club !== myNm) return;
            try { if (foFrBcastState(c2).phase === "live") { go = "#/friendly?id=" + c2.id; mineNow = true; } } catch (eS) {}
          });
        } catch (e2) {}
      }
      if (!go) {
        // THE WORLD'S OWN FRIENDLIES, which the ledger above never carries.
        // The umpire banks an accepted challenge at the hour lock - status
        // 'played', result line withheld until the last ball - so on air is:
        // past its hour, inside the window, and either banked-and-quiet or
        // accepted with the umpire still to catch up. world_my_friendlies
        // only ever answers with MY club's matches, so it is a summons.
        try {
          var wfh2 = window.__foFriendlyHome;
          var wr2 = (wfh2 && wfh2.rows) ? wfh2.rows() : [];
          var nw2 = Date.now();
          (wr2 || []).forEach(function (f2) {
            if (go || !f2) return;
            var t02 = +f2.playAtMs;
            if (!(t02 > 0) || nw2 < t02 || nw2 >= t02 + 3 * 3600000) return;
            if ((f2.status === "played" && !f2.text) || f2.status === "accepted") {
              go = "#/feed?fr=" + f2.id; mineNow = true;
            }
          });
        } catch (eW3) {}
      }
      // "Live" alone does not tell a manager whose match is on; if it is his,
      // say so, because that is the difference between a badge and a summons
      var lbl = ml.querySelector(".live-txt");
      if (!lbl) { lbl = document.createElement("span"); lbl.className = "live-txt"; ml.appendChild(lbl); }
      var want = mineNow ? "LIVE" : "Live";
      if (lbl.textContent !== want) lbl.textContent = want;
      ml.classList.toggle("mine", !!mineNow);
      if (go) { ml.setAttribute("data-go", go); ml.classList.add("on"); } else ml.classList.remove("on");
      // the world clock is pinned to the right of the topbar and out of flow,
      // so on a phone the pill lands underneath it and the two print on top of
      // each other. While something is on air the pill takes that corner: the
      // clock is ambient, this is a summons.
      try { var tb9 = document.getElementById("topbar"); if (tb9) tb9.classList.toggle("fo-live-on", !!go); } catch (eTb9) {}
      // on a wide screen the clock keeps its corner, so the pill has to stop
      // short of it - measured, because the clock's width is its content
      try {
        var wc9 = document.getElementById("fo-wclock");
        var wide9 = window.innerWidth > 640;
        ml.style.marginRight = (go && wide9 && wc9 && wc9.offsetWidth) ? (wc9.offsetWidth + 20) + "px" : "";
      } catch (eMr) {}
    } catch (e) {}
  }
  try { setInterval(foMliveTick, 20000); } catch (e) {}
  window.addEventListener("hashchange", function () { setTimeout(foMliveTick, 150); });
  function ensureNav() {
    try {
      var tb = document.getElementById("topbar"); if (!tb) return;
      // scoped reactive hide: a topbar timer keeps re-adding the week/bank
      // chips, so this tiny observer (topbar-only) hides them instantly;
      // the page-wide decorator observer stays retired
      if (!tb.__foChipObs && window.MutationObserver) {
        tb.__foChipObs = 1;
        new MutationObserver(function () { foHideWeekChip(); }).observe(tb, { childList: true, subtree: true });
      }
      // put the app icon in the brand, on every page, and make it open the league menu
      var brand = tb.querySelector(".brand");
      if (brand && !brand.querySelector(".fo-brandicon")) {
        brand.innerHTML = '<img class="fo-brandicon" src="' + APPICON + '" alt=""> Fifty Overs';
        // NO TITLE ATTRIBUTE ON THE MASTHEAD. A phone has no hover, so the
        // browser answers a tap on a titled element by drawing its own slab
        // along the bottom of the screen - the "Club home" bar. The crest is
        // obviously the way home; it does not need labelling.
        brand.style.cursor = "pointer"; brand.removeAttribute("title");
        // the app icon is a Home button
        brand.addEventListener("click", function (e) { e.preventDefault(); location.hash = "#/club"; if (typeof window.route === "function") window.route(); });
      }
      var mk = function (label, cls, fn) { var el = document.createElement("a"); el.className = cls; el.href = "#"; el.textContent = label; el.addEventListener("click", function (e) { e.preventDefault(); fn(); }); return el; };
      var status = tb.querySelector("#fo-top-status");
      foHideWeekChip();
      // Group every nav link in one container: display:contents on desktop
      // (layout untouched), a horizontally scrolling pill bar on phones.
      var wrap = tb.querySelector(".fo-nav-scroll");
      if (!wrap) {
        wrap = document.createElement("div"); wrap.className = "fo-nav-scroll";
        var bA = tb.querySelector(".brand");
        tb.insertBefore(wrap, bA ? bA.nextSibling : tb.firstChild);
      }
      // Everything anchor-shaped goes into the scrolling pill row EXCEPT the
      // two things that are header furniture rather than navigation. Both are
      // <a> only so they can be tapped: the Live pill, and the world clock,
      // which carries the day, the season, the live count and the UTC time.
      // The phone stylesheet hides .fo-nav-scroll outright, so anything swept
      // in here is invisible on a phone - which is exactly what happened to
      // the clock on every page but the club home.
      var KEEP_IN_HEADER = { "fo-mlive": 1, "fo-wclock": 1 };
      [].slice.call(tb.children).forEach(function (el) {
        if (el.tagName === "A" && !KEEP_IN_HEADER[el.id] && !/\bbrand\b/.test(el.className || "")) wrap.appendChild(el);
      });
      // NO HAMBURGER. The menu bar under the masthead carries every room at
      // every width, so a second way in was the same building with two front
      // doors. Anything left over from an older build goes.
      var mbtn = tb.querySelector("#fo-mnav-btn");
      if (mbtn && mbtn.parentNode) mbtn.parentNode.removeChild(mbtn);
      var ml = tb.querySelector("#fo-mlive");
      if (!ml) {
        ml = document.createElement("a"); ml.id = "fo-mlive"; ml.href = "#";
        ml.innerHTML = "<span class='live-dot'></span><span class='live-txt'>Live</span>";
        // parented by foHdrRight below, which owns that corner
        tb.appendChild(ml);
        ml.addEventListener("click", function (e) {
          e.preventDefault();
          var go = ml.getAttribute("data-go");
          if (go) { location.hash = go; if (typeof window.route === "function") window.route(); }
        });
      }
      foMliveTick();
      var addNav = function (cls, label, fn) {
        var a = tb.querySelector("a." + cls); if (!a) a = mk(label, cls, fn);
        if (a.parentNode !== wrap) wrap.appendChild(a);
      };
      // Circuit-only era: Training and Transfers pills are retired until
      // those systems return in their redesigned form
      ["fo-training", "fo-transfers"].forEach(function (c) { var st0 = tb.querySelector("a." + c); if (st0) st0.remove(); });
      // ONE LIVE PILL. There were two: this nav-row "Live Match" link, which
      // only ever knew about a match running in this tab and which the phone
      // layout hides along with the whole pill row, and #fo-mlive in the
      // header, which knows about that AND the league fixture, the broadcast
      // window and a friendly. Two pills for one fact is one too many, and
      // the one that could not see your league match is the one to go.
      var lv = tb.querySelector("a.fo-live"); if (lv) lv.remove();
      // retired pills (still routable: Matches panel, Live pill, home quick links)
      ["fo-friendly", "fo-matchday"].forEach(function (c) { var st = tb.querySelector("a." + c); if (st) st.remove(); });
      // The Manual is retired until a better one is written; the pill goes with
      // the room, and any pill left over from an older build is swept away.
      var gd0 = tb.querySelector("a.fo-guide"); if (gd0) gd0.remove();
      try { foBellWire(tb, wrap); } catch (eB) {}
      // Admin is founder-only: add it for the league founder, remove it for
      // everyone else (so a player never inherits a stale Admin link).
      var adm0 = tb.querySelector("a.fo-league");
      if (SYNC && SYNC.isFounder) { if (!adm0) addNav("fo-league", "Admin", openLeagueMenu); }
      else if (adm0) adm0.remove();
      // Log out: in a league session it signs out of the account; solo it
      // just walks back out to the front door.
      var out0 = tb.querySelector("a.fo-logout");
      if (!out0) out0 = mk("Log out", "fo-logout", function () {
        if (JWT) { doLogout(); }
        else if (typeof window.foDoorOpen === "function") window.foDoorOpen();
      });
      if (out0.parentNode !== wrap) wrap.appendChild(out0);
      // date + time (in the topbar flow, to the right of the status)
      var ck = tb.querySelector("#fo-clock");
      if (!ck) { ck = document.createElement("span"); ck.id = "fo-clock"; tickClock(); }
      tb.appendChild(ck);
      foHdrRight(tb);
      // active-pill marking for overlay-added links (engine handles its own via data-nav)
      try {
        var route0 = (location.hash || "#/club").split("?")[0];
        var navMap = { "fo-circuit": "#/circuit" };
        wrap.querySelectorAll("a").forEach(function (a) {
          for (var c in navMap) if (a.classList.contains(c)) a.classList.toggle("on", route0 === navMap[c]);
        });
        if (window.innerWidth <= 820) {
          var onA = wrap.querySelector("a.on");
          if (onA && onA.scrollIntoView) onA.scrollIntoView({ inline: "center", block: "nearest" });
        }
      } catch (e) {}
    } catch (e) {}
  }
  // ---- league metadata: which clubs are human, who manages them, when they
  // joined, and whether that manager is online (needs 0018 for presence) ----
  window.__foClubMeta = null;
  function foClubMetaFetch() {
    try {
      if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
      var done = function (clubs, members) {
        var byMid = {};
        (members || []).forEach(function (m2) { byMid[m2.id] = m2; });
        var map = {};
        (clubs || []).forEach(function (r) {
          var nm = r.club && r.club.name; if (!nm) return;
          var mem = byMid[r.manager_id] || {};
          map[nm] = { human: true, manager: mem.display_name || "manager", mid: r.manager_id, est: r.updated_at || null, lastSeen: mem.last_seen || null };
        });
        window.__foClubMeta = map;
        try { lsSet("fol_clubmeta_" + LG.id, JSON.stringify(map)); } catch (eC) {}
        // pages painted before the fetch landed guessed "bot" - repaint
        try { var pg0 = document.getElementById("page"); if (pg0) pg0.__scoutSig = null; foRenderScout(); } catch (eR) {}
      };
      sel("league_clubs", "league_id=eq." + LG.id + "&select=club,manager_id,updated_at").then(function (clubs) {
        sel("members", "league_id=eq." + LG.id + "&select=id,display_name,last_seen").then(function (mem) { done(clubs, mem); })
          .catch(function () {
            sel("members", "league_id=eq." + LG.id + "&select=id,display_name").then(function (mem) { done(clubs, mem); }).catch(function () { done(clubs, []); });
          });
      }).catch(function () {});
    } catch (e) {}
  }
  // the last fetched roster survives a refresh, so human clubs never flash
  // as bots while the live fetch is in flight
  function foClubMetaNow() {
    if (window.__foClubMeta) return window.__foClubMeta;
    try {
      var c = JSON.parse(lsGet("fol_clubmeta_" + (LG ? LG.id : "solo")) || "null");
      if (c) window.__foClubMeta = c;
    } catch (e) {}
    return window.__foClubMeta;
  }
  function foClubHuman(nm) { var m = foClubMetaNow(); return !!(m && m[nm]); }
  function foClubManager(nm) { var m = foClubMetaNow(); return (m && m[nm] && m[nm].manager) || null; }
  function foLastSeenTxt(nm) {
    var m = foClubMetaNow(), e = m && m[nm];
    if (!e || !e.lastSeen) return null;
    var mins = Math.floor((Date.now() - new Date(e.lastSeen).getTime()) / 60000);
    if (mins < 5) return "online";
    if (mins < 60) return "last online " + mins + " min ago";
    if (mins < 36 * 60) { var h = Math.round(mins / 60); return "last online " + h + " hour" + (h === 1 ? "" : "s") + " ago"; }
    var d0 = Math.round(mins / 1440); return "last online " + d0 + " day" + (d0 === 1 ? "" : "s") + " ago";
  }
  function foClubOnline(nm) {
    var m = foClubMetaNow(), e = m && m[nm];
    if (!e || !e.lastSeen) return null;
    return (Date.now() - new Date(e.lastSeen).getTime()) < 5 * 60000;
  }
  setInterval(foClubMetaFetch, 120000);
  setTimeout(foClubMetaFetch, 2500);
  // presence heartbeat (harmless 404 until the 0018 migration is run)
  setInterval(function () { try { if (SYNC && SYNC.started && !SYNC.practice && LG) rpc("touch_presence", { p_league_id: LG.id }).catch(function () {}); } catch (e) {} }, 180000);
  setTimeout(function () { try { if (SYNC && SYNC.started && !SYNC.practice && LG) rpc("touch_presence", { p_league_id: LG.id }).catch(function () {}); } catch (e) {} }, 4000);
  // Practice Game opens a setup screen (opponent + pitch + weather); after a short
  // breather it drops you on the lineup. Nothing is randomised or auto-started.
  var foFriendlies = [];
  function startFriendly() {
    try {
      if (typeof GD === "undefined" || !GD.teams || GD.teams.length < 2) {
        // on slow connections the league snapshot may still be loading –
        // wait a beat and retry once before telling the user anything
        toast("Loading your league\u2026");
        setTimeout(function () {
          if (typeof GD !== "undefined" && GD.teams && GD.teams.length >= 2) foMatchSetup(null);
          else { toast("No clubs to play yet \u2014 log in to your league first.", "error"); if (!(LG && SYNC)) openLeagueMenu(); }
        }, 900);
        return;
      }
      foMatchSetup(null);
    } catch (e) { toast("Could not open Practice Game: " + ((e && e.message) || e), "error"); }
  }
  var FO_PITCHES = ["balanced", "flat", "green", "dry", "slow", "cracked", "twoPaced"];
  // display names only · the engine's pitch ids never change
  var FO_PITCH_NAMES = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Crumbling", slow: "Slow", cracked: "Sticky", twoPaced: "Two-paced" };
  function foPitchName(id) { var k = String(id == null ? "" : (id.id || id)).trim(); return FO_PITCH_NAMES[k] || foTitle(k); }
  // condition symbols for scorecard heroes: the same monoline glyphs the
  // conditions field guide uses (foCondCards), with the word in the tooltip
  var FO_PITCH_SYM = {
    Balanced: "<path d='M12 4v16m-5 0h10M7 5.5h10'/><path d='M7 5.5 4 12a3.4 3.4 0 0 0 6 0L7 5.5Zm10 0L14 12a3.4 3.4 0 0 0 6 0l-3-6.5Z'/>",
    Green: "<path d='M6 20c.5-5-.5-8-2-10M12 20c0-7-.6-10-1.5-13M18 20c-.5-5 .5-8 2-10M12 20c1.5-4 3.5-6 5.5-7'/>",
    Crumbling: "<path d='M4 19 9 12l3 3 4-7 4 6'/>",
    Flat: "<path d='M3 15h18M6 9h12'/>",
    Slow: "<path d='M3 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0'/>",
    Sticky: "<path d='M4 18 9 10l3 4 5-8'/><path d='M14 6h3v3'/>",
    "Two-paced": "<path d='M4 9h11M12 6l3 3-3 3M4 16h6M8 14l2 2-2 2'/>"
  };
  var FO_WX_SYM = {
    Sunny: "<circle cx='12' cy='12' r='4'/><path d='M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19'/>",
    Overcast: "<path d='M7 18h9.5a4 4 0 1 0-.8-7.9A6 6 0 0 0 4.2 12 3.5 3.5 0 0 0 7 18z'/>",
    Misty: "<path d='M4 9h16M6 13h13M8 17h8'/>",
    Humid: "<path d='M12 4c3 4 5 6.3 5 8.8a5 5 0 0 1-10 0C7 10.3 9 8 12 4z'/>",
    Hot: "<path d='M10 4a2 2 0 0 1 4 0v8.6a4 4 0 1 1-4 0V4z'/><path d='M12 9v7'/>",
    Scorching: "<path d='M12 3c1 3.5 5 5.2 5 9.5a5 5 0 0 1-10 0c0-3 2.2-4.6 3.2-7 .6 1.4 1.8 2 1.8 2Z'/>",
    Drizzle: "<path d='M7 14h9.5a4 4 0 1 0-.8-7.9A6 6 0 0 0 4.2 8 3.5 3.5 0 0 0 7 14z'/><path d='m9 17-1 2.5M13 17l-1 2.5M17 17l-1 2.5'/>",
    Windy: "<path d='M9.6 4.6A2 2 0 1 1 11 8H3M12.6 19.4A2 2 0 1 0 14 16H3M17.7 7.7A2.5 2.5 0 1 1 19.5 12H3'/>",
    Chilly: "<path d='M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9'/>",
    "Dew later": "<path d='M4 20h16'/><path d='M12 4.5c2.2 3 3.7 4.8 3.7 6.7a3.7 3.7 0 0 1-7.4 0c0-1.9 1.5-3.7 3.7-6.7z'/>"
  };
  function foCondSvg(nm, path) {
    return "<span class='fo-cond-sym' title='" + nm + "'><svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + path + "</svg></span>";
  }
  function foCondSymbols() {
    try {
      document.querySelectorAll(".fo-live-sub, .fo-cond-pill").forEach(function (el) {
        if (el.__foSym) return;
        el.__foSym = 1;
        var h = el.innerHTML, o = h;
        Object.keys(FO_PITCH_SYM).forEach(function (nm) {
          h = h.replace(new RegExp("\\b" + nm + " pitch\\b", "g"), foCondSvg(nm + " pitch", FO_PITCH_SYM[nm]));
        });
        Object.keys(FO_WX_SYM).forEach(function (nm) {
          h = h.replace(new RegExp("\\b" + nm + "\\b", "g"), foCondSvg(nm, FO_WX_SYM[nm]));
        });
        if (h !== o) el.innerHTML = h;
      });
    } catch (e) {}
  }
  function foTitle(s) { return (s || "").charAt(0).toUpperCase() + (s || "").slice(1); }
  function foMatchSetup(preIx) {
    try {
      if (typeof GD === "undefined" || !GD.teams || GD.teams.length < 2) { alert("No clubs to play yet."); return; }
      var ex = document.getElementById("fo-setup"); if (ex) ex.remove();
      var mp = !!(SYNC && SYNC.started && !SYNC.practice && LG);
      var opts = GD.teams.map(function (t, i) {
        if (i === App.teamIx) return "";
        if (mp && foClubHuman(t.name)) return "";   // humans: only by accepted challenge
        return "<option value='" + i + "'" + (i === preIx ? " selected" : "") + ">" + E(t.name) + "</option>";
      }).join("");
      var pitchOpts = FO_PITCHES.map(function (p) { return "<option value='" + p + "'>" + foPitchName(p) + "</option>"; }).join("");
      var wxOpts = (typeof WXLIST !== "undefined" ? WXLIST : ["Sunny"]).map(function (w) { return "<option>" + w + "</option>"; }).join("");
      var m = document.createElement("div"); m.id = "fo-setup"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Practice match</div><h3>Set up a friendly</h3>" +
        "<label>Opponent<select id='fo-su-opp'>" + opts + "</select></label>" +
        "<label>Pitch<select id='fo-su-pitch'>" + pitchOpts + "</select></label>" +
        "<label>Weather<select id='fo-su-wx'>" + wxOpts + "</select></label>" +
        (mp ? "<div class='small' style='margin-top:6px'>Practice games are against computer clubs. To play a friend, open their club page and send a <b>challenge</b>.</div>" : "") +
        "<div class='fo-modal-act'><button class='fo-su-go primary'>Schedule friendly ▸</button><button class='fo-su-cancel'>Cancel</button></div></div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e) { if (e.target === m) m.remove(); });
      m.querySelector(".fo-su-cancel").addEventListener("click", function () { m.remove(); });
      m.querySelector(".fo-su-go").addEventListener("click", function () {
        var ix = parseInt(m.querySelector("#fo-su-opp").value, 10);
        if (isNaN(ix)) { alert("Pick an opponent first."); return; }
        var slotProb = null;
        try { slotProb = foFrSlotProblem(new Date(Date.now() + 2 * 60000), [userTeam().name]); } catch (eSl) {}
        if (slotProb) { say(slotProb); return; }
        var pitch = m.querySelector("#fo-su-pitch").value, wx = m.querySelector("#fo-su-wx").value;
        m.remove();
        foBreakScreen(foAddFriendly(ix, pitch, wx));
      });
    } catch (e) { say(e); }
  }
  // scheduled practice games survive a refresh (stored per league, on-device;
  // a bot game starts the moment you press Play, so this is a reminder list)
  function foFrSchedKey() { return "fol_frsched_" + (LG ? LG.id : "solo"); }
  function foFrSchedSave() { try { lsSet(foFrSchedKey(), JSON.stringify(foFriendlies || [])); } catch (e) {} }
  function foFrSchedLoad() {
    var k = foFrSchedKey();
    if (foFrSchedLoad.__k === k) return;
    foFrSchedLoad.__k = k;
    try {
      var a = JSON.parse(lsGet(k) || "[]");
      if (a.length && !(foFriendlies || []).length) foFriendlies = a;
    } catch (e) {}
  }
  function foAddFriendly(ix, pitch, wx) {
    foFriendlies = (foFriendlies || []).filter(function (f) { return f.oppName !== GD.teams[ix].name; });   // one per opponent
    var fr = { oppIx: ix, oppName: GD.teams[ix].name, pitch: pitch, weather: wx, seed: 4200 + ix * 7 + foFriendlies.length * 13 };
    foFriendlies.push(fr);
    foFrSchedSave();
    if (SYNC) SYNC.__plannerSig = null;                     // let the upcoming list pick it up
    return fr;
  }
  // A short breather before the lineup, so a match never feels rushed.
  function foBreakScreen(fr) {
    try {
      var ex = document.getElementById("fo-break"); if (ex) ex.remove();
      var m = document.createElement("div"); m.id = "fo-break"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card fo-break-card'><div class='fo-modal-eyebrow'>Get ready</div>" +
        "<h3>vs " + E(fr.oppName) + "</h3><div class='fo-break-cond'>" + E(foTitle(fr.pitch)) + " pitch · " + E(fr.weather) + "</div>" +
        "<div class='fo-break-clock' id='fo-break-clock'>2:00</div>" +
        "<div class='small'>Take a breather · your lineup opens when the timer ends.</div>" +
        "<div class='fo-modal-act'><button class='fo-su-go primary'>Set lineup now ▸</button></div></div>";
      document.body.appendChild(m);
      var secs = 120;
      var go = function () { if (m.__t) { clearInterval(m.__t); m.__t = null; } if (m.parentNode) m.remove(); foPlayFriendly(fr); };
      m.querySelector(".fo-su-go").addEventListener("click", go);
      m.__t = setInterval(function () {
        secs--; var c = document.getElementById("fo-break-clock");
        if (c) c.textContent = Math.floor(secs / 60) + ":" + ("0" + (secs % 60)).slice(-2);
        if (secs <= 0) go();
      }, 1000);
    } catch (e) { say(e); foPlayFriendly(fr); }
  }
  function foPlayFriendly(fr) {
    // a live match is running: resume it (never silently restart)
    try {
      if (typeof M !== "undefined" && M && !M.done) {
        var sameOpp = App.pending && App.pending.__friendly && App.pending.away === fr.oppName;
        if (sameOpp) { location.hash = "#/match"; if (typeof window.route === "function") window.route(); return; }
        foConfirm({ danger: true, title: "A match is already in progress", body: "Abandon the live match and start this friendly instead?", confirm: "Abandon & start", cancel: "Keep playing" })
          .then(function (ok) { if (ok) foChallenge(fr.oppIx, fr.pitch, fr.weather); else { location.hash = "#/match"; if (typeof window.route === "function") window.route(); } });
        return;
      }
    } catch (e) {}
    try {
      var slotProb2 = foFrSlotProblem(new Date(Date.now() + 2 * 60000), [userTeam().name]);
      if (slotProb2) { say(slotProb2); return; }
    } catch (eSl2) {}
    foChallenge(fr.oppIx, fr.pitch, fr.weather);
  }
  function foPracBcKey() { return "fol_pracbc_" + (LG ? LG.id : "solo"); }
  function foPracBc() { try { return JSON.parse(lsGet(foPracBcKey()) || "null"); } catch (e) { return null; } }
  // Play the pending practice match to completion in the engine (silently,
  // with the same per-ball tracker the resolver banks for friendlies) and
  // store the broadcast locally. Returns the pseudo-challenge row, or false
  // so the caller can fall back to the old interactive viewer.
  function foPracBroadcast() {
    try {
      if (typeof stepBall !== "function" || typeof startPendingIfNeeded !== "function") return false;
      var pend = App.pending; if (!pend) return false;
      var prevPage = App.page, prevOME = window.onMatchEnd;
      // practice plays at full freshness: fatigue only matters in league play.
      // Stash the real ladder and restore it after - the sim mutates players.
      var fatStash = [];
      try {
        [pend.home, pend.away].forEach(function (nm2) {
          var t9 = (GD.teams || []).filter(function (t8) { return t8 && t8.name === nm2; })[0];
          ((t9 && t9.players) || []).forEach(function (p9) { if (p9) { fatStash.push([p9, p9.fatigue]); p9.fatigue = "rested"; } });
        });
      } catch (eFs) {}
      try {
        window.__foPracRun = 1;
        window.onMatchEnd = function () {};          // practice: no fatigue, no form, no App.results
        App.page = "__resolve__";
        try { M = null; } catch (e0) {}
        startPendingIfNeeded();
        if (App.tossState && App.tossState.stage !== "done" && typeof resolveToss === "function") resolveToss(App.orders.tossCall || "H");
        var track = [], g = 0;
        while (typeof M !== "undefined" && M && !M.done && g++ < 3000) {
          if (typeof autoPick === "function") autoPick();
          stepBall();
          try {
            var li = (M.log && M.log[0]) ? M.log[0].inn : M.inns;
            var inn2 = M.innings[li] || M.innings[M.inns];
            if (inn2) {
              var rc = function (x) { return (x && x.p) ? { n: x.p.name, r: x.r || 0, b: x.b || 0, f4: x.f4 || 0, f6: x.f6 || 0 } : null; };
              var bwr = inn2.bowlers && inn2.bowlers[inn2.curBowlerName];
              track.push({ L: M.log.length, i: li, s: rc(inn2.bat[inn2.striker]), ns: rc(inn2.bat[inn2.nonstriker]),
                bw: bwr ? { n: inn2.curBowlerName, r: bwr.r || 0, w: bwr.w || 0, b: bwr.b || 0 } : null,
                sc: [inn2.runs || 0, inn2.wkts || 0, inn2.legal || 0] });
            }
          } catch (eT) {}
        }
        if (typeof M === "undefined" || !M || !M.done || !M.result) return false;
        var ratings = ""; try { ratings = ratingsTable({ home: M.meta.home, away: M.meta.away, innings: M.innings, result: M.result }); } catch (eR) {}
        var fant = []; try { fant = window.foFantasyPoints ? foFantasyPoints(M.innings) : []; } catch (eF) {}
        var mom = (M.result && M.result.mom) || (fant[0] ? fant[0].n + " (" + fant[0].pts + " pts)" : "");
        var tossTxt = ""; try { tossTxt = (App.tossState && App.tossState.txt) || ""; } catch (eTs) {}
        var at = Date.now();
        var c = {
          id: "prac-" + at, challenger_club: M.meta.home, opponent_club: M.meta.away,
          pitch: M.meta.pitch || pend.pitch || "balanced", weather: M.meta.weather || pend.weather || "Sunny",
          play_at: new Date(at).toISOString(), status: "played", __practice: true,
          result: { result_text: (M.result && M.result.text) || "Played", mom: mom,
                    scorecard: (M.innings || []).map(foInnCard), worm: M.worm || null,
                    log: M.log || [], track: track, ratings_html: ratings, fantasy: fant, toss: tossTxt }
        };
        try { lsSet(foPracBcKey(), JSON.stringify(c)); }
        catch (eS) { try { c.result.log = []; c.result.track = []; lsSet(foPracBcKey(), JSON.stringify(c)); } catch (eS2) {} }
        try { foSaveFrHist({ innings: M.innings, meta: M.meta, worm: M.worm, result: M.result, __at: at }); } catch (eH) {}
        return c;
      } finally {
        App.page = prevPage; window.onMatchEnd = prevOME; window.__foPracRun = 0;
        try { fatStash.forEach(function (x9) { x9[0].fatigue = x9[1]; }); } catch (eFr) {}
        try { M = null; } catch (e1) {}
        App.pending = null;
        try { App.tossState = null; } catch (e2) {}
      }
    } catch (e) { return false; }
  }
  // el is the cross that was pressed: the question opens on the fixture row
  function foRemoveFriendly(i, el) {
    var fr = foFriendlies[i]; if (!fr) return;
    try {
      if (typeof M !== "undefined" && M && !M.done && App.pending && App.pending.__friendly && App.pending.away === fr.oppName) {
        foSayAt(el, "That friendly is being played right now - finish or abandon the match first.", "error"); return;
      }
    } catch (e) {}
    var go = function () { foFriendlies.splice(i, 1); foFrSchedSave(); if (typeof window.route === "function") window.route(); };
    if (!el) { go(); return; }
    foDecide(el, { q: "Remove the friendly vs " + fr.oppName + "?",
      note: "You can schedule another from their club page any time.",
      ok: "Remove it", cancel: "Keep it", danger: true, onYes: go });
  }

